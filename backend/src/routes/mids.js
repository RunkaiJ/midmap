
const express = require("express");
const router = express.Router();

const clean = (s) => (s ?? "").toString().trim();
const up = (s) => clean(s).toUpperCase();

/** bulk insert helper (global actions only) */
async function insertGlobal(db, action, branch, person, rows) {
    if (!rows.length) return { inserted: 0, total: 0 };

    // We always insert into the same set of columns; for rows that don't need
    // manufacturer_name or bad_mid, we pass nulls.
    const cols = `(changed_at, action, changed_by, actor_branch, bad_mid, good_mid, manufacturer_name)`;

    const values = [];
    const params = [];
    const per = 7;
    rows.forEach((r, i) => {
        const o = i * per;
        values.push(
            `(NOW(), $${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${
                o + 6
            })`
        );
        params.push(
            action,
            person || null,
            branch,
            r.bad_mid ?? null,
            r.good_mid ?? null,
            r.manufacturer_name ?? null
        );
    });

    const sql = `
    INSERT INTO midmap.change_log ${cols}
    VALUES ${values.join(",")}
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

    const res = await db.query(sql, params);
    return { inserted: res.rowCount, total: rows.length };
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
router.post("/triplets/bulk", express.json(), async (req, res) => {
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

    // Split into alias + name sets and de-dupe each
    const aliasRows = dedupeAliases(rows);
    const nameRows = dedupeNames(rows);

    try {
        await db.query("BEGIN");
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
router.post("/aliases/bulk", express.json(), async (req, res) => {
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
        const r = await insertGlobal(db, "global_alias", branch, person, rows);
        return res.json({
            ok: true,
            inserted: r.inserted,
            skipped: r.total - r.inserted,
        });
    } catch (e) {
        console.error("mids/aliases/bulk failed:", e);
        return res
            .status(500)
            .json({ ok: false, error: e.message || "insert failed" });
    }
});

/** Names: [{ manufacturer_name, good_mid }] */
router.post("/names/bulk", express.json(), async (req, res) => {
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
        const r = await insertGlobal(db, "global_name", branch, person, rows);
        return res.json({
            ok: true,
            inserted: r.inserted,
            skipped: r.total - r.inserted,
        });
    } catch (e) {
        console.error("mids/names/bulk failed:", e);
        return res
            .status(500)
            .json({ ok: false, error: e.message || "insert failed" });
    }
});

module.exports = router;
