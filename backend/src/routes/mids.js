const express = require("express");
const router = express.Router();

const clean = (s) => (s ?? "").toString().trim();
const up = (s) => clean(s).toUpperCase();

async function applyToCanonical(db, aliasRows, nameRows, person) {
    // 1) Upsert canonical from *names* (pick 1 row per good_mid to avoid multi-update)
    if (nameRows.length) {
        await db.query(
            `
    WITH raw AS (
      SELECT
        upper(btrim(x.good_mid)) AS good_mid,
        btrim(x.manufacturer_name) AS manufacturer_name
      FROM jsonb_to_recordset($1::jsonb) AS x(good_mid text, manufacturer_name text)
    ),
    norm AS (
      SELECT good_mid, manufacturer_name
      FROM raw
      WHERE manufacturer_name <> ''
        AND upper(manufacturer_name) <> good_mid   -- ignore "name == MID"
    ),
    -- choose ONE row per good_mid to avoid "affect row a second time"
    dedup AS (
      SELECT good_mid, manufacturer_name,
             row_number() OVER (
               PARTITION BY good_mid
               ORDER BY length(manufacturer_name) DESC, manufacturer_name
             ) AS rn
      FROM norm
    )
    INSERT INTO midmap.canonical_manufacturers (good_mid, manufacturer_name, created_at)
    SELECT good_mid, manufacturer_name, clock_timestamp()
    FROM dedup
    WHERE rn = 1
    ON CONFLICT (good_mid) DO UPDATE
      SET manufacturer_name = EXCLUDED.manufacturer_name
    WHERE btrim(midmap.canonical_manufacturers.manufacturer_name)
          IS DISTINCT FROM btrim(EXCLUDED.manufacturer_name);
  `,
            [JSON.stringify(nameRows)]
        );
    }

    // 2) Ensure canonical exists for alias-only good_mids (name stays NULL)
    if (aliasRows.length) {
        await db.query(
            `
      INSERT INTO midmap.canonical_manufacturers (good_mid, created_at)
      SELECT DISTINCT x.good_mid, clock_timestamp()
      FROM jsonb_to_recordset($1::jsonb) AS x(bad_mid text, good_mid text)
      LEFT JOIN midmap.canonical_manufacturers c ON c.good_mid = x.good_mid
      WHERE c.id IS NULL
    `,
            [JSON.stringify(aliasRows)]
        );
    }

    // 3) name_mappings → canonical.id (insert all distinct pairs)
    if (nameRows.length) {
        await db.query(
            `
    WITH raw AS (
      SELECT
        upper(btrim(x.good_mid)) AS good_mid,
        btrim(x.manufacturer_name) AS manufacturer_name
      FROM jsonb_to_recordset($1::jsonb) AS x(good_mid text, manufacturer_name text)
    ),
    norm AS (
      SELECT DISTINCT good_mid, manufacturer_name
      FROM raw
      WHERE manufacturer_name <> ''
        AND upper(manufacturer_name) <> good_mid
    ),
    cm AS (SELECT id, good_mid FROM midmap.canonical_manufacturers)
    INSERT INTO midmap.name_mappings (manufacturer_name, good_manufacturer_id, created_by, created_at)
    SELECT n.manufacturer_name, cm.id, $2, clock_timestamp()
    FROM norm n
    JOIN cm ON cm.good_mid = n.good_mid
    ON CONFLICT DO NOTHING;
  `,
            [JSON.stringify(nameRows), person || null]
        );
    }

    // 4) mid_aliases → canonical.id
    if (aliasRows.length) {
        await db.query(
            `
      WITH cm AS (SELECT id, good_mid FROM midmap.canonical_manufacturers)
      INSERT INTO midmap.mid_aliases (bad_mid, good_manufacturer_id, created_by, created_at)
      SELECT x.bad_mid, cm.id, $2, clock_timestamp()
      FROM jsonb_to_recordset($1::jsonb) AS x(bad_mid text, good_mid text)
      JOIN cm ON cm.good_mid = x.good_mid
      ON CONFLICT DO NOTHING
    `,
            [JSON.stringify(aliasRows), person || null]
        );
    }
}

/** bulk insert helper (global actions only) */
async function insertGlobal(db, action, branch, person, rows) {
    if (!rows.length) return { inserted: 0, total: 0 };

    if (action === "global_alias") {
        const sql = `
      INSERT INTO midmap.change_log
        (changed_at, action, changed_by, actor_branch, bad_mid, good_mid, manufacturer_name)
      SELECT clock_timestamp(), 'global_alias', $1, $2, x.bad_mid, x.good_mid, NULL
      FROM jsonb_to_recordset($3::jsonb) AS x(bad_mid text, good_mid text)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
        const r = await db.query(sql, [
            person || null,
            branch,
            JSON.stringify(rows),
        ]);
        return { inserted: r.rowCount, total: rows.length };
    }

    if (action === "global_name") {
        const sql = `
      INSERT INTO midmap.change_log
        (changed_at, action, changed_by, actor_branch, bad_mid, good_mid, manufacturer_name)
      SELECT clock_timestamp(), 'global_name', $1, $2, NULL, x.good_mid, x.manufacturer_name
      FROM jsonb_to_recordset($3::jsonb) AS x(manufacturer_name text, good_mid text)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
        const r = await db.query(sql, [
            person || null,
            branch,
            JSON.stringify(rows),
        ]);
        return { inserted: r.rowCount, total: rows.length };
    }

    throw new Error(`Unknown action ${action}`);
}

/** de-dupe helpers (within the incoming payload) */
function dedupeAliases(rows) {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
        const bad_mid = up(r.bad_mid);
        const good_mid = up(r.good_mid);
        const k = `${bad_mid}|${good_mid}`;
        if (bad_mid && good_mid && !seen.has(k)) {
            seen.add(k);
            out.push({ bad_mid, good_mid });
        }
    }
    return out;
}
function dedupeNames(rows) {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
        const manufacturer_name = clean(r.manufacturer_name);
        const good_mid = up(r.good_mid);
        const k = `${manufacturer_name}|${good_mid}`;
        if (manufacturer_name && good_mid && !seen.has(k)) {
            seen.add(k);
            out.push({ manufacturer_name, good_mid });
        }
    }
    return out;
}

/** ----------------- Routes ----------------- */
/** Triplets: [{ bad_mid, manufacturer_name, good_mid }] -> write two global logs */
router.post("/triplets/bulk", async (req, res) => {
    const db = req.app.get("pg");
    const branch = clean(req.body.actor_branch);
    const person = clean(req.body.changed_by);
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

    if (!branch)
        return res
            .status(400)
            .json({ ok: false, error: "actor_branch required" });
    if (!person)
        return res
            .status(400)
            .json({ ok: false, error: "changed_by required" });

    const aliasRows = dedupeAliases(rows);
    const nameRows = dedupeNames(rows);
    if (!aliasRows.length && !nameRows.length) {
        return res.json({
            ok: true,
            inserted: 0,
            skipped: 0,
            inserted_alias: 0,
            inserted_name: 0,
        });
    }

    try {
        await db.query("BEGIN");

        // 1) write audit log
        const a = await insertGlobal(
            db,
            "global_alias",
            branch,
            person,
            aliasRows
        );
        const n = await insertGlobal(
            db,
            "global_name",
            branch,
            person,
            nameRows
        );

        // 2) materialize to normalized tables
        await applyToCanonical(db, aliasRows, nameRows, person);

        await db.query("COMMIT");

        const inserted = a.inserted + n.inserted;
        const total = a.total + n.total;
        return res.json({
            ok: true,
            inserted,
            skipped: total - inserted,
            inserted_alias: a.inserted,
            inserted_name: n.inserted,
        });
    } catch (e) {
        await db.query("ROLLBACK");
        console.error("mids/triplets/bulk failed:", e);
        return res
            .status(500)
            .json({ ok: false, error: e.message || "insert failed" });
    }
});

/** Aliases: [{ bad_mid, good_mid }] */
router.post("/aliases/bulk", async (req, res) => {
    const db = req.app.get("pg");
    const branch = clean(req.body.actor_branch);
    const person = clean(req.body.changed_by);
    const rows = dedupeAliases(
        Array.isArray(req.body.rows) ? req.body.rows : []
    );

    if (!branch)
        return res
            .status(400)
            .json({ ok: false, error: "actor_branch required" });
    if (!person)
        return res
            .status(400)
            .json({ ok: false, error: "changed_by required" });

    try {
        await db.query("BEGIN");
        const r = await insertGlobal(db, "global_alias", branch, person, rows);
        await applyToCanonical(db, rows, [], person);
        await db.query("COMMIT");
        return res.json({
            ok: true,
            inserted: r.inserted,
            skipped: r.total - r.inserted,
        });
    } catch (e) {
        await db.query("ROLLBACK");
        console.error("mids/aliases/bulk failed:", e);
        return res
            .status(500)
            .json({ ok: false, error: e.message || "insert failed" });
    }
});

/** Names: [{ manufacturer_name, good_mid }] */
router.post("/names/bulk", async (req, res) => {
    const db = req.app.get("pg");
    const branch = clean(req.body.actor_branch);
    const person = clean(req.body.changed_by);
    const rows = dedupeNames(Array.isArray(req.body.rows) ? req.body.rows : []);

    if (!branch)
        return res
            .status(400)
            .json({ ok: false, error: "actor_branch required" });
    if (!person)
        return res
            .status(400)
            .json({ ok: false, error: "changed_by required" });

    try {
        await db.query("BEGIN");
        const r = await insertGlobal(db, "global_name", branch, person, rows);
        await applyToCanonical(db, [], rows, person);
        await db.query("COMMIT");
        return res.json({
            ok: true,
            inserted: r.inserted,
            skipped: r.total - r.inserted,
        });
    } catch (e) {
        await db.query("ROLLBACK");
        console.error("mids/names/bulk failed:", e);
        return res
            .status(500)
            .json({ ok: false, error: e.message || "insert failed" });
    }
});

module.exports = router;
