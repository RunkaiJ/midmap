const express = require("express");
const router = express.Router();
const withTransaction = require("../transaction");

const clean = (s) => (s ?? "").toString().trim();
const up = (s) => clean(s).toUpperCase();

async function autofillCanonFromAlias(db, pairs, changedBy, actorBranch) {
    if (!pairs.length) return { updated: 0 };

    // Upsert only when canonical name is NULL/blank
    const sql = `
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb)
        AS x(good_mid text, manufacturer_name text)
    ),
    up AS (
      INSERT INTO midmap.canonical_manufacturers (good_mid, manufacturer_name, created_at)
      SELECT i.good_mid, i.manufacturer_name, clock_timestamp()
      FROM incoming i
      ON CONFLICT (good_mid) DO UPDATE
        SET manufacturer_name = EXCLUDED.manufacturer_name
      WHERE btrim(midmap.canonical_manufacturers.manufacturer_name) IS NULL
         OR btrim(midmap.canonical_manufacturers.manufacturer_name) = ''
      RETURNING id, good_mid, manufacturer_name
    )
    INSERT INTO midmap.name_mappings (manufacturer_name, good_manufacturer_id, created_by, created_at)
    SELECT u.manufacturer_name, u.id, $2, clock_timestamp()
    FROM up u
    ON CONFLICT DO NOTHING
    RETURNING 1;
  `;

    // Run the upsert + name_mappings first; count rows via result.rowCount
    const upRes = await db.query(sql, [
        JSON.stringify(pairs),
        changedBy || null,
    ]);

    // Log only for rows we **actually** updated (select those rows again)
    const logSql = `
    WITH updated AS (
      SELECT c.id, c.good_mid, c.manufacturer_name
      FROM midmap.canonical_manufacturers c
      JOIN jsonb_to_recordset($1::jsonb)
        AS x(good_mid text, manufacturer_name text)
        ON c.good_mid = x.good_mid
      WHERE btrim(c.manufacturer_name) = btrim(x.manufacturer_name)
    )
    INSERT INTO midmap.change_log
      (changed_at, action, changed_by, actor_branch,
       bad_mid, good_mid, manufacturer_name)
    SELECT clock_timestamp(), 'auto_name', $2, $3,
           NULL, u.good_mid, u.manufacturer_name
    FROM updated u
    ON CONFLICT DO NOTHING;
  `;

    await db.query(logSql, [
        JSON.stringify(pairs),
        changedBy || "resolver",
        actorBranch || null,
    ]);
    return { updated: upRes.rowCount };
}

router.post("/mids", async (req, res) => {
    const db = req.app.get("pg");
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length)
        return res.status(400).json({ ok: false, error: "items[] required" });

    const autofill = !!req.body.autofill; // still opt-in, but silent
    const actorBranch = clean(req.body.actor_branch);
    const changedBy = clean(req.body.changed_by) || "resolver";

    const uniq = (arr) => [...new Set(arr)];
    const bads = uniq(items.map((i) => up(i.bad_mid || "")).filter(Boolean));
    const names = uniq(
        items.map((i) => clean(i.manufacturer_name || "")).filter(Boolean)
    );

    const [a, n] = await Promise.all([
        bads.length
            ? db.query(
                  `select a.bad_mid, m.good_mid
           from midmap.mid_aliases a
           join midmap.canonical_manufacturers m on m.id = a.good_manufacturer_id
           where a.bad_mid = any($1)`,
                  [bads]
              )
            : { rows: [] },
        names.length
            ? db.query(
                  `select nm.manufacturer_name, m.good_mid
           from midmap.name_mappings nm
           join midmap.canonical_manufacturers m on m.id = nm.good_manufacturer_id
           where nm.manufacturer_name = any($1)`,
                  [names]
              )
            : { rows: [] },
    ]);

    const aliasMap = new Map(a.rows.map((r) => [r.bad_mid, r.good_mid]));
    const nameMap = new Map(
        n.rows.map((r) => [r.manufacturer_name, r.good_mid])
    );

    // Build results and collect potential autofill pairs
    const toAutofill = []; // {good_mid, manufacturer_name}
    const results = items.map(({ bad_mid = "", manufacturer_name = "" }) => {
        const bU = up(bad_mid);
        const nC = clean(manufacturer_name);
        if (bU && aliasMap.has(bU)) {
            const gm = aliasMap.get(bU);
            if (autofill && nC)
                toAutofill.push({ good_mid: gm, manufacturer_name: nC });
            return {
                bad_mid: bU,
                manufacturer_name: nC,
                good_mid: gm,
                method: "auto_alias",
            };
        }
        if (nC && nameMap.has(nC)) {
            return {
                bad_mid: bU,
                manufacturer_name: nC,
                good_mid: nameMap.get(nC),
                method: "auto_name",
            };
        }
        return {
            bad_mid: bU,
            manufacturer_name: nC,
            good_mid: null,
            method: null,
        };
    });

    // Deduplicate by good_mid so we don't fight within one request
    const seen = new Set();
    const pairs = [];
    for (const p of toAutofill) {
        if (!seen.has(p.good_mid)) {
            seen.add(p.good_mid);
            pairs.push(p);
        }
    }

    if (autofill && pairs.length) {
        try {
            await withTransaction(db, (client) =>
                autofillCanonFromAlias(client, pairs, changedBy, actorBranch));
        } catch (e) {
            console.error("autofill failed:", e);
            return res.status(500).json({ ok: false, error: "Failed to save automatic name mappings" });
        }
    }

    res.json({ ok: true, results });
});

module.exports = router;
