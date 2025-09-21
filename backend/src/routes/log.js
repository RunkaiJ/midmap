// src/routes/log.js
const express = require("express");
const router = express.Router();

const clean = (s) => (s ?? "").toString().trim();
const up = (s) => clean(s).toUpperCase();

function toISODate(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    const s = v.toString().trim();

    // Excel serial (Windows epoch 1899-12-30)
    if (/^\d+(\.\d+)?$/.test(s)) {
        const serial = Math.floor(Number(s));
        const base = Date.UTC(1899, 11, 30);
        const d = new Date(base + serial * 86400000);
        if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }

    const d2 = new Date(s);
    if (!isNaN(d2)) return d2.toISOString().slice(0, 10);
    return null;
}

/* -------- meta: branches for dropdowns -------- */
router.get("/meta", async (req, res) => {
    const db = req.app.get("pg");
    const { rows } = await db.query(
        `select station, port_code from midmap.branches order by station`
    );
    const branches = rows.map((r) => ({
        station: r.station,
        port_code: r.port_code,
        label: `${r.station}${r.port_code ? " | " + r.port_code : ""}`,
    }));
    res.json({ branches });
});

/* -------- log changes -------- */
router.post("/changes", async (req, res) => {
    const db = req.app.get("pg");

    const branch = clean(req.body.branch);
    const person = clean(req.body.person);
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

    if (!branch)
        return res.status(400).json({ ok: false, error: "branch required" });
    if (!rows.length) return res.json({ ok: true, inserted: 0 });

    // Normalize rows
    const normRaw = rows
        .map((r) => ({
            airline_3d: clean(r.airline_3d).slice(0, 3),
            master_bill_no: clean(r.master_bill_no),
            importer_id: clean(r.importer_id) || null,
            arrival_airport: clean(r.arrival_airport) || null,
            arrival_date: toISODate(r.arrival_date),
            manufacturer_name: clean(r.manufacturer_name) || null,
            bad_mid: up(r.bad_mid),
            good_mid: up(r.good_mid),
            action: clean(r.method)
        }))
        .filter(
            (r) => r.airline_3d && r.master_bill_no && r.bad_mid && r.good_mid
        );

    if (!normRaw.length) return res.json({ ok: true, inserted: 0 });

    // Deduplicate within this payload using the same uniqueness logic as the index
    const seen = new Set();
    const keyOf = (r) =>
        [
            r.arrival_date,
            r.airline_3d,
            (r.master_bill_no || "").trim(),
            (r.arrival_airport || "").trim().toUpperCase(),
            r.importer_id ? null : r.client_name || "", // client_name resolved later; keep slot
            (r.bad_mid || "").trim().toUpperCase(),
            (r.good_mid || "").trim().toUpperCase(),
        ].join("|");

    const norm = [];
    for (const r of normRaw) {
        const k = keyOf(r);
        if (!seen.has(k)) {
            seen.add(k);
            norm.push(r);
        }
    }

    // Resolve client_name from importer_id
    let clientMap = new Map();
    const importerIds = [
        ...new Set(norm.map((r) => r.importer_id).filter(Boolean)),
    ];
    if (importerIds.length) {
        const q = await db.query(
            `select importer_id, client_name from midmap.clients where importer_id = any($1)`,
            [importerIds]
        );
        clientMap = new Map(q.rows.map((r) => [r.importer_id, r.client_name]));
    }

    try {
        await db.query("BEGIN");

        const colsPer = 12; // parameters per row (changed_at is NOW())
        const values = [];
        const params = [];

        norm.forEach((r, i) => {
            const client_name = r.importer_id
                ? clientMap.get(r.importer_id) || null
                : null;
            const o = i * colsPer;
            values.push(`(
        NOW(),           -- changed_at
        $${o + 1},       -- action
        $${o + 2},       -- changed_by
        $${o + 3},       -- actor_branch
        $${o + 4},       -- airline_3d
        $${o + 5},       -- master_bill_no
        $${o + 6},       -- importer_id
        $${o + 7},       -- client_name
        $${o + 8},       -- arrival_airport
        $${o + 9},       -- arrival_date
        $${o + 10},      -- bad_mid
        $${o + 11},      -- manufacturer_name
        $${o + 12}       -- good_mid
      )`);

            params.push(
                r.action,
                person || null,
                branch,
                r.airline_3d,
                r.master_bill_no,
                r.importer_id,
                client_name,
                r.arrival_airport,
                r.arrival_date,
                r.bad_mid,
                r.manufacturer_name,
                r.good_mid
            );
        });

        const sql = `
      INSERT INTO midmap.change_log
        (changed_at, action, changed_by, actor_branch,
         airline_3d, master_bill_no, importer_id, client_name,
         arrival_airport, arrival_date, bad_mid, manufacturer_name, good_mid)
      VALUES
        ${values.join(",\n")}
      ON CONFLICT DO NOTHING         -- <— works with your expression unique index
      RETURNING id
    `;

        const result = await db.query(sql, params);
        await db.query("COMMIT");

        const inserted = result.rowCount;
        const skipped = norm.length - inserted; // duplicates blocked by the unique index
        return res.json({ ok: true, inserted, skipped });
    } catch (e) {
        await db.query("ROLLBACK");
        console.error("log/changes insert failed:", e);
        return res.status(500).send(e.message || "log insert failed");
    }
});

module.exports = router;
