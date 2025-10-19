const express = require("express");
const router = express.Router();

const clean = (s) => (s ?? "").toString().trim();

function buildFilters(q) {
    const p = [];
    // Always exclude global actions from reports
    const where = ["cl.action NOT IN ('global_alias','global_name')"];

    // Branch filter will target COALESCE(b.station, cl.actor_branch)
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

    return {
        sql: "WHERE " + where.join(" AND "),
        params: p,
    };
}

// --- meta (filters) ---------------------------------------------------------
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
           from midmap.branches
          order by station`
            )
            .then((r) => r.rows),
    ]);
    res.json({ clients, branches });
});

// // --- grouped (JSON for UI) + CSV export ------------------------------------
// router.get("/grouped", async (req, res) => {
//     const db = req.app.get("pg");
//     const { sql, params } = buildFilters(req.query);

//     // Build aggregation so "by" (changed_by) is preserved per pair
//     const cte = `
//         WITH base AS (
//             SELECT
//             cl.arrival_date::date                         AS arrival_date,
//             cl.airline_3d,
//             cl.master_bill_no,
//             cl.client_name,
//             -- Branch determined by arrival airport when possible
//             COALESCE(b.station, cl.actor_branch)          AS branch,
//             cl.bad_mid,
//             cl.good_mid,
//             /* logged name if present, otherwise canonical name */
//             COALESCE(
//                 NULLIF(TRIM(cl.manufacturer_name), ''),
//                 NULLIF(TRIM(cm.manufacturer_name), '')
//             )                                             AS manufacturer_name,
//             cl.action                                     AS method,
//             NULLIF(TRIM(cl.changed_by), '')               AS changed_by
//             FROM midmap.change_log cl
//             LEFT JOIN midmap.canonical_manufacturers cm
//             ON cm.good_mid = cl.good_mid
//             LEFT JOIN midmap.branches b
//             ON b.port_code = cl.arrival_airport
//             -- your WHERE goes here
//             ${sql}
//         ),
//         pairs AS (
//             SELECT
//             arrival_date, airline_3d, master_bill_no, client_name, branch,
//             bad_mid, good_mid, manufacturer_name,
//             COALESCE(changed_by,'') AS changed_by,
//             MIN(method) AS method,
//             COUNT(*) AS cnt
//             FROM base
//             GROUP BY
//             arrival_date, airline_3d, master_bill_no, client_name, branch,
//             bad_mid, good_mid, manufacturer_name, changed_by
//         ),
//         shipments AS (
//             SELECT
//             arrival_date,
//             (airline_3d || '-' || master_bill_no) AS shipment,
//             client_name AS client,
//             branch,
//             SUM(cnt) AS changes_count,
//             jsonb_agg(
//                 jsonb_build_object(
//                 'bad_mid', bad_mid,
//                 'good_mid', good_mid,
//                 'manufacturer_name', COALESCE(manufacturer_name, ''),
//                 'method', method,
//                 'by', changed_by,
//                 'count', cnt
//                 )
//                 ORDER BY bad_mid, good_mid, changed_by
//             ) AS pairs
//             FROM pairs
//             GROUP BY arrival_date, airline_3d, master_bill_no, client_name, branch
//         )
//     `;


//     const wantCSV = (req.query.format || "").toLowerCase() === "csv";
//     if (!wantCSV) {
//         const limit = Math.max(
//             1,
//             Math.min(500, Number(req.query.limit || 100))
//         );
//         const offset = Math.max(0, Number(req.query.offset || 0));

//         const totalSql = `
//       ${cte}
//       select count(*)::int as total
//         from (select 1 from shipments) t;
//     `;
//         const dataSql = `
//         ${cte}
//         select
//             to_char(arrival_date, 'YYYY-MM-DD') as arrival_date,
//             shipment, client, branch, changes_count, pairs
//         from shipments
//         order by arrival_date desc, shipment
//         limit $${params.length + 1} offset $${params.length + 2};
//         `;
//         const [tot, data] = await Promise.all([
//             db.query(totalSql, params).then((r) => r.rows[0].total),
//             db.query(dataSql, [...params, limit, offset]).then((r) => r.rows),
//         ]);
//         return res.json({ total: tot, limit, offset, rows: data });
//     }

//     // Human-readable CSV
//     const exportSql = `
//     ${cte}
//     select
//         to_char(arrival_date, 'YYYY-MM-DD') as arrival_date,
//         shipment, client, branch, changes_count, pairs
//     from shipments
//     order by arrival_date desc, shipment;
//     `;
//     const rows = await db.query(exportSql, params).then((r) => r.rows);

//     const header = [
//         "arrival_date",
//         "shipment",
//         "client",
//         "branch",
//         "changes",
//         "people",
//         "pairs", // e.g. BAD -> GOOD ×3; BAD2 -> GOOD2
//     ].join(",");

//     const lines = [header];

//     rows.forEach((r) => {
//         const ppl = uniq(
//             (r.pairs || []).map((p) => (p.by || "").trim()).filter(Boolean)
//         ).join("; ");
//         const pairText = (r.pairs || [])
//             .map((p) => {
//                 const cnt = p.count > 1 ? ` ×${p.count}` : "";
//                 const left = (p.manufacturer_name || "").trim();
//                 return left
//                     ? `${left}: ${p.bad_mid} -> ${p.good_mid}${cnt}`
//                     : `${p.bad_mid} -> ${p.good_mid}${cnt}`;
//             })
//             .join("; ");


//         lines.push(
//             [
//                 csvEsc(r.arrival_date),
//                 csvEsc(r.shipment),
//                 csvEsc(r.client || ""),
//                 csvEsc(r.branch || ""),
//                 r.changes_count ?? 0,
//                 csvEsc(ppl),
//                 csvEsc(pairText),
//             ].join(",")
//         );
//     });

//     const out = lines.join("\n");
//     res.setHeader(
//         "content-disposition",
//         `attachment; filename="midmap_report_${Date.now()}.csv"`
//     );
//     res.setHeader("content-type", "text/csv; charset=utf-8");
//     res.send(out);
// });

// --- flat table report -------------------------------------------------------
router.get("/table", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const db = req.app.get("pg");
  const { sql, params } = buildFilters(req.query);

  const limit  = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  // CTE layout:
  // base     = change_log filtered + computed branch + MAWB
  // aliasmap = bad_mid -> (canonical id, canonical good_mid)
  // logged   = good_mid -> canonical id (if good_mid exists as canonical)
  // chosen   = decide which canonical to use for the row, and build Notes
  // rows     = join chosen canonical to details (name/address/city/zip)
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
      LEFT JOIN midmap.branches b
        ON b.port_code = cl.arrival_airport
      ${sql}
    ),
    aliasmap AS (
      SELECT
        ma.bad_mid,
        cm.id       AS alias_canon_id,
        cm.good_mid AS alias_good_mid
      FROM midmap.mid_aliases ma
      JOIN midmap.canonical_manufacturers cm
        ON cm.id = ma.good_manufacturer_id
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
          -- if alias suggests a different canonical (or logged missing), prefer alias
          WHEN am.alias_canon_id IS NOT NULL
               AND (lg.logged_canon_id IS NULL OR am.alias_canon_id <> lg.logged_canon_id)
          THEN am.alias_canon_id
          -- else, if the logged good_mid exists, use it
          WHEN lg.logged_canon_id IS NOT NULL THEN lg.logged_canon_id
          -- fallback: alias if present, else NULL
          ELSE am.alias_canon_id
        END AS chosen_canon_id,
        CASE
          WHEN am.alias_canon_id IS NOT NULL
               AND (lg.logged_canon_id IS NULL OR am.alias_canon_id <> lg.logged_canon_id)
          THEN 'a more accurate replacement would be ' || am.alias_good_mid
          WHEN lg.logged_canon_id IS NULL AND am.alias_canon_id IS NULL
          THEN 'no canonical found'
          ELSE ''
        END AS note
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
        ch.bad_mid,
        cm.good_mid        AS correct_mid,
        cm.manufacturer_name AS name,
        COALESCE(cm.address, '')  AS address,
        COALESCE(cm.city, '')     AS city,
        COALESCE(cm.zipcode, '')  AS zipcode,
        ch.note
      FROM chosen ch
      LEFT JOIN midmap.canonical_manufacturers cm
        ON cm.id = ch.chosen_canon_id
    )
  `;

  const totalSql = `
    ${cte}
    SELECT COUNT(*)::int AS total FROM rows;
  `;

  const dataSql = `
    ${cte}
    SELECT
      to_char(arrival_date, 'YYYY-MM-DD') AS arrival_date,
      client, branch,
      mawb,
      bad_mid      AS wrong_mid,
      correct_mid,
      name, address, city, zipcode,
      note
    FROM rows
    ORDER BY arrival_date DESC, mawb, bad_mid
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  try {
    const [tot, data] = await Promise.all([
      db.query(totalSql, params).then(r => r.rows[0].total),
      db.query(dataSql, [...params, limit, offset]).then(r => r.rows),
    ]);
    res.json({ total: tot, limit, offset, rows: data });
  } catch (e) {
    console.error("GET /reports/table error:", e);
    res.status(500).send(e.message || "Internal error");
  }
});

const ExcelJS = require("exceljs");

// --- Excel export ------------------------------------------------------------
router.get("/table.xlsx", async (req, res) => {
    const db = req.app.get("pg");
    const { sql, params } = buildFilters(req.query);

    // same CTE logic as /reports/table, but no LIMIT/OFFSET (export all matches)
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
      LEFT JOIN midmap.branches b
        ON b.port_code = cl.arrival_airport
      ${sql}
    ),
    aliasmap AS (
      SELECT
        ma.bad_mid,
        cm.id       AS alias_canon_id,
        cm.good_mid AS alias_good_mid
      FROM midmap.mid_aliases ma
      JOIN midmap.canonical_manufacturers cm
        ON cm.id = ma.good_manufacturer_id
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
        END AS chosen_canon_id,
        CASE
          WHEN am.alias_canon_id IS NOT NULL
               AND (lg.logged_canon_id IS NULL OR am.alias_canon_id <> lg.logged_canon_id)
          THEN 'a more accurate replacement would be ' || am.alias_good_mid
          WHEN lg.logged_canon_id IS NULL AND am.alias_canon_id IS NULL
          THEN 'no canonical found'
          ELSE ''
        END AS note
      FROM base ba
      LEFT JOIN aliasmap am ON am.bad_mid = ba.bad_mid
      LEFT JOIN logged   lg ON lg.good_mid = ba.logged_good_mid
    )
    SELECT
      ch.mawb,
      ch.bad_mid                              AS wrong_mid,
      cm.good_mid                             AS correct_mid,
      cm.manufacturer_name                    AS name,
      COALESCE(cm.address, '')                AS address,
      COALESCE(cm.city, '')                   AS city,
      COALESCE(cm.zipcode, '')                AS zipcode,
      ch.note
    FROM chosen ch
    LEFT JOIN midmap.canonical_manufacturers cm
      ON cm.id = ch.chosen_canon_id
    ORDER BY ch.mawb, ch.bad_mid;
  `;

    try {
        const rows = await db.query(cte, params).then((r) => r.rows);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Report");

        // Header
        ws.columns = [
            { header: "MAWB", key: "mawb", width: 24 },
            { header: "Wrong MID", key: "wrong_mid", width: 22 },
            { header: "Correct MID", key: "correct_mid", width: 22 },
            { header: "Name", key: "name", width: 40 },
            { header: "Address", key: "address", width: 50 },
            { header: "City", key: "city", width: 18 },
            { header: "Zipcode", key: "zipcode", width: 12 },
            { header: "Notes", key: "note", width: 40 },
        ];

        // Data
        for (const r of rows) ws.addRow(r);

        // Simple styling for header row
        const header = ws.getRow(1);
        header.font = { bold: true };
        header.alignment = { vertical: "middle" };

        // Response headers
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="midmap_report_${Date.now()}.xlsx"`
        );
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        await wb.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error("GET /reports/table.xlsx error:", e);
        res.status(500).send(e.message || "Failed to generate Excel");
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
