const express = require("express");
const router = express.Router();

const clean = (s) => (s ?? "").toString().trim();

function buildColumnFilters(q, startIndex = 1) {
    // filters only on visible columns (no note)
    const p = [];
    const w = [];

    function add(colKey, param) {
        if (!param) return;
        p.push(`%${clean(param)}%`);
        w.push(`${colKey} ILIKE $${startIndex + p.length - 1}`);
    }

    add("mawb", q.mawb);
    add("wrong_mid", q.wrong_mid);
    add("correct_mid", q.correct_mid);
    add("name", q.name);
    add("address", q.address);
    add("city", q.city);
    add("zipcode", q.zipcode);

    return { sql: w.length ? " AND " + w.join(" AND ") : "", params: p };
}

function buildFilters(q) {
    const p = [];
    const where = ["cl.action NOT IN ('global_alias','global_name')"];

    if (q.branch) {
        p.push(clean(q.branch));
        where.push(`COALESCE(b.station, cl.actor_branch) = $${p.length}`);
    }
    if (q.client) {
        p.push(clean(q.client));
        where.push(`cl.client_name = $${p.length}`);
    }
    if (q.from) {
        p.push(q.from);
        where.push(`cl.arrival_date::date >= $${p.length}::date`);
    }
    if (q.to) {
        p.push(q.to);
        where.push(`cl.arrival_date::date <= $${p.length}::date`);
    }

    return { sql: "WHERE " + where.join(" AND "), params: p };
}

// --- meta -------------------------------------------------------------------
router.get("/meta", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const db = req.app.get("pg");
    const [clients, branches] = await Promise.all([
        db
            .query(
                `select client_name from midmap.clients order by client_name`
            )
            .then((r) => r.rows.map((x) => x.client_name)),
        db
            .query(
                `select station, port_code, (station || ' | ' || port_code) as label
              from midmap.branches order by station`
            )
            .then((r) => r.rows),
    ]);
    res.json({ clients, branches });
});

// --- JSON table --------------------------------------------------------------
router.get("/table", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const db = req.app.get("pg");

    const baseFilters = buildFilters(req.query);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const cte = `
    WITH base AS (
      SELECT
        cl.arrival_date::date                AS arrival_date,
        cl.client_name,
        COALESCE(b.station, cl.actor_branch) AS branch,
        (cl.airline_3d || '-' || cl.master_bill_no) AS mawb,
        cl.bad_mid,
        NULLIF(TRIM(cl.good_mid), '')        AS logged_good_mid
      FROM midmap.change_log cl
      LEFT JOIN midmap.branches b ON b.port_code = cl.arrival_airport
      ${baseFilters.sql}
    ),
    aliasmap AS (
      SELECT ma.bad_mid, cm.id AS alias_canon_id, cm.good_mid AS alias_good_mid
      FROM midmap.mid_aliases ma
      JOIN midmap.canonical_manufacturers cm ON cm.id = ma.good_manufacturer_id
    ),
    logged AS (
      SELECT cm.good_mid, cm.id AS logged_canon_id
      FROM midmap.canonical_manufacturers cm
    ),
    chosen AS (
      SELECT
        ba.arrival_date, ba.client_name, ba.branch, ba.mawb,
        ba.bad_mid, ba.logged_good_mid,
        am.alias_canon_id, am.alias_good_mid,
        lg.logged_canon_id,
        CASE
          WHEN am.alias_canon_id IS NOT NULL
               AND (lg.logged_canon_id IS NULL OR am.alias_canon_id <> lg.logged_canon_id)
          THEN am.alias_canon_id
          WHEN lg.logged_canon_id IS NOT NULL
          THEN lg.logged_canon_id
          ELSE am.alias_canon_id
        END AS chosen_canon_id
      FROM base ba
      LEFT JOIN aliasmap am ON am.bad_mid = ba.bad_mid
      LEFT JOIN logged   lg ON lg.good_mid = ba.logged_good_mid
    ),
    rows AS (
      SELECT
        ch.arrival_date,
        ch.client_name AS client,
        ch.branch,
        ch.mawb,
        ch.bad_mid                      AS wrong_mid,
        cm.good_mid                     AS correct_mid,
        cm.manufacturer_name            AS name,
        COALESCE(to_jsonb(cm)->>'address', '') AS address,
        COALESCE(to_jsonb(cm)->>'city', '')    AS city,
        COALESCE(to_jsonb(cm)->>'zipcode', '') AS zipcode
      FROM chosen ch
      LEFT JOIN midmap.canonical_manufacturers cm
        ON cm.id = ch.chosen_canon_id
    )
  `;

    const colFilter = buildColumnFilters(
        req.query,
        baseFilters.params.length + 1
    );

    const totalSql = `
    ${cte}
    SELECT COUNT(*)::int AS total
    FROM rows
    WHERE 1=1 ${colFilter.sql};
  `;

    const dataSql = `
    ${cte}
    SELECT
      to_char(arrival_date, 'YYYY-MM-DD') AS arrival_date,
      client, branch, mawb, wrong_mid, correct_mid, name, address, city, zipcode
    FROM rows
    WHERE 1=1 ${colFilter.sql}
    ORDER BY arrival_date DESC, mawb, wrong_mid
    LIMIT $${baseFilters.params.length + colFilter.params.length + 1}
    OFFSET $${baseFilters.params.length + colFilter.params.length + 2};
  `;

    try {
        const base = baseFilters.params;
        const totalParams = [...base, ...colFilter.params];
        const dataParams = [...base, ...colFilter.params, limit, offset];

        const [tot, data] = await Promise.all([
            db.query(totalSql, totalParams).then((r) => r.rows[0].total),
            db.query(dataSql, dataParams).then((r) => r.rows),
        ]);

        res.json({ total: tot, limit, offset, rows: data });
    } catch (e) {
        console.error("GET /reports/table error:", e);
        res.status(500).send(e.message || "Internal error");
    }
});

// --- Excel export ------------------------------------------------------------
const ExcelJS = require("exceljs");
const Cursor = require("pg-cursor");

router.get("/table.xlsx", async (req, res) => {
    res.set("Cache-Control", "no-store");

    const db = req.app.get("pg");
    const baseFilters = buildFilters(req.query);

    const cte = `
    WITH base AS (
      SELECT
        cl.arrival_date::date                AS arrival_date,
        cl.client_name,
        COALESCE(b.station, cl.actor_branch) AS branch,
        (cl.airline_3d || '-' || cl.master_bill_no) AS mawb,
        cl.bad_mid,
        NULLIF(TRIM(cl.good_mid), '')        AS logged_good_mid
      FROM midmap.change_log cl
      LEFT JOIN midmap.branches b ON b.port_code = cl.arrival_airport
      ${baseFilters.sql}
    ),
    aliasmap AS (
      SELECT ma.bad_mid, cm.id AS alias_canon_id, cm.good_mid AS alias_good_mid
      FROM midmap.mid_aliases ma
      JOIN midmap.canonical_manufacturers cm ON cm.id = ma.good_manufacturer_id
    ),
    logged AS (
      SELECT cm.good_mid, cm.id AS logged_canon_id
      FROM midmap.canonical_manufacturers cm
    ),
    chosen AS (
      SELECT
        ba.mawb, ba.bad_mid, ba.logged_good_mid,
        am.alias_canon_id, am.alias_good_mid,
        lg.logged_canon_id,
        CASE
          WHEN am.alias_canon_id IS NOT NULL
               AND (lg.logged_canon_id IS NULL OR am.alias_canon_id <> lg.logged_canon_id)
          THEN am.alias_canon_id
          WHEN lg.logged_canon_id IS NOT NULL
          THEN lg.logged_canon_id
          ELSE am.alias_canon_id
        END AS chosen_canon_id
      FROM base ba
      LEFT JOIN aliasmap am ON am.bad_mid = ba.bad_mid
      LEFT JOIN logged   lg ON lg.good_mid = ba.logged_good_mid
    ),
    rows AS (
      SELECT
        ch.mawb,
        ch.bad_mid                      AS wrong_mid,
        cm.good_mid                     AS correct_mid,
        cm.manufacturer_name            AS name,
        COALESCE(to_jsonb(cm)->>'address', '') AS address,
        COALESCE(to_jsonb(cm)->>'city', '')    AS city,
        COALESCE(to_jsonb(cm)->>'zipcode', '') AS zipcode
      FROM chosen ch
      LEFT JOIN midmap.canonical_manufacturers cm
        ON cm.id = ch.chosen_canon_id
    )
    `;

    const colFilter = buildColumnFilters(
        req.query,
        baseFilters.params.length + 1
    );

    const sql = `
    ${cte}
    SELECT
        mawb,
        wrong_mid,
        correct_mid,
        name,
        address,
        city,
        zipcode,
        ''::text AS note
    FROM rows
    WHERE 1=1 ${colFilter.sql}
    ORDER BY mawb, wrong_mid;
    `;

    let client;
    let cursor;
    let releaseError;
    let closing;
    const closeCursor = () => {
        if (!cursor) return Promise.resolve();
        if (!closing) closing = new Promise((resolve, reject) =>
            cursor.close((error) => error ? reject(error) : resolve()));
        return closing;
    };
    const onClose = () => {
        if (!res.writableFinished) closeCursor().catch((error) => { releaseError = error; });
    };
    res.once("close", onClose);
    try {
        const params = [...baseFilters.params, ...colFilter.params];

        // ---------------------------
        // STREAMING EXCEL WORKBOOK
        // ---------------------------
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="midmap_report_${Date.now()}.xlsx"`
        );
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: false,
            useSharedStrings: false,
        });

        const ws = wb.addWorksheet("Report");

        ws.columns = [
            { header: "MAWB", key: "mawb", width: 24 },
            { header: "Wrong MID", key: "wrong_mid", width: 22 },
            { header: "Correct MID", key: "correct_mid", width: 22 },
            { header: "Name", key: "name", width: 40 },
            { header: "Address", key: "address", width: 60 },
            { header: "City", key: "city", width: 18 },
            { header: "Zipcode", key: "zipcode", width: 12 },
            { header: "Notes", key: "note", width: 40 },
        ];

        // bold header row
        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true };
        headerRow.commit();

        // ---------------------------
        // STREAM ROWS FROM DB
        // ---------------------------
        client = await db.connect();
        if (res.destroyed) return;
        cursor = client.query(new Cursor(sql, params));

        const batchSize = 500;

        const readNext = () =>
            new Promise((resolve, reject) => {
                cursor.read(batchSize, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

        let batch;
        while (!res.destroyed && (batch = await readNext()) && batch.length > 0) {
            for (const row of batch) {
                ws.addRow(row).commit();
            }
        }

        if (!res.destroyed) {
            ws.commit();
            await wb.commit();
        }
    } catch (e) {
        console.error("GET /reports/table.xlsx error:", e);
        if (!res.headersSent) {
            res.removeHeader("Content-Disposition");
            res.status(500).type("text/plain").send("Failed to generate Excel");
        } else {
            res.destroy(e);
        }
    } finally {
        res.off("close", onClose);
        if (cursor) {
            try {
                await closeCursor();
            } catch (error) {
                releaseError = error;
            }
        }
        if (client) client.release(releaseError);
    }
});


module.exports = router;

// // --- helpers ----------------------------------------------------------------
// function uniq(a) {
//     return [...new Set(a)];
// }
// function csvEsc(v) {
//     const s = (v ?? "").toString().replace(/"/g, '""');
//     return /[",\n]/.test(s) ? `"${s}"` : s;
// }
