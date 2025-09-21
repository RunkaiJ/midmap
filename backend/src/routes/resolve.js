const express = require("express");
const router = express.Router();

const clean = (s) => (s ?? "").toString().trim();
const up = (s) => clean(s).toUpperCase();

router.post("/mids", async (req, res) => {
    const db = req.app.get("pg");
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length)
        return res.status(400).json({ ok: false, error: "items[] required" });

    // normalize
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

    const results = items.map(({ bad_mid = "", manufacturer_name = "" }) => {
        const bU = up(bad_mid);
        const nC = clean(manufacturer_name);
        if (bU && aliasMap.has(bU))
            return {
                bad_mid: bU,
                manufacturer_name: nC,
                good_mid: aliasMap.get(bU),
                method: "auto_alias",
            };
        if (nC && nameMap.has(nC))
            return {
                bad_mid: bU,
                manufacturer_name: nC,
                good_mid: nameMap.get(nC),
                method: "auto_name",
            };
        return {
            bad_mid: bU,
            manufacturer_name: nC,
            good_mid: null,
            method: null,
        };
    });

    res.json({ ok: true, results });
});

module.exports = router;
