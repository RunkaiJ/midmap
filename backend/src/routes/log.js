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

    const branch = clean(req.body?.branch);
    const person = clean(req.body?.person);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    if (!branch)
        return res.status(400).json({ ok: false, error: "branch required" });
    if (!rows.length) return res.json({ ok: true, inserted: 0 });


    if (!person || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
        return res.status(400).json({ ok: false, error: "person and valid row objects required" });
    }
    const normalized = rows.map((r) => ({
        airline_3d: clean(r.airline_3d).slice(0, 3),
        master_bill_no: clean(r.master_bill_no),
        importer_id: clean(r.importer_id) || null,
        arrival_airport: up(r.arrival_airport) || null,
        arrival_date: toISODate(r.arrival_date),
        manufacturer_name: clean(r.manufacturer_name) || null,
        bad_mid: up(r.bad_mid),
        good_mid: up(r.good_mid),
        action: clean(r.method),
    }));
    if (normalized.some((r) => !r.airline_3d || !r.master_bill_no || !r.good_mid ||
        !["auto_alias", "auto_name"].includes(r.action))) {
        return res.status(400).json({ ok: false, error: "Invalid audit row: flight, bill, good_mid and automatic method required" });
    }
    try {
        // One atomic statement; client names are resolved before database dedupe.
        // JSON input avoids the per-row SQL parameter limit.
        const result = await db.query(`
            INSERT INTO midmap.change_log
                (action, changed_by, actor_branch, airline_3d, master_bill_no,
                 importer_id, client_name, arrival_airport, arrival_date,
                 bad_mid, manufacturer_name, good_mid)
            SELECT x.action::midmap.change_action, $2, $3, x.airline_3d, x.master_bill_no,
                   x.importer_id, c.client_name, x.arrival_airport, x.arrival_date,
                   x.bad_mid, x.manufacturer_name, x.good_mid
            FROM jsonb_to_recordset($1::jsonb) AS x(
                action text, airline_3d text, master_bill_no text, importer_id text,
                arrival_airport text, arrival_date date, bad_mid text,
                manufacturer_name text, good_mid text)
            LEFT JOIN midmap.clients c ON c.importer_id = x.importer_id
            ON CONFLICT DO NOTHING
            RETURNING id
        `, [JSON.stringify(normalized), person, branch]);
        return res.json({ ok: true, inserted: result.rowCount, skipped: rows.length - result.rowCount });
    } catch (error) {
        console.error("log/changes insert failed:", error);
        return res.status(500).json({ ok: false, error: "Failed to save audit log" });
    }
});

module.exports = router;
