const express = require("express");
const router = express.Router();

const clean = (s) => (s ?? "").toString().trim();

function buildFilters(q) {
    const p = [];
    // Always exclude global actions from reports
    const where = ["cl.action NOT IN ('global_alias','global_name')"];

    if (q.branch) {
        p.push((q.branch ?? "").toString().trim());
        where.push(`cl.actor_branch = $${p.length}`);
    }
    if (q.client) {
        p.push((q.client ?? "").toString().trim());
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

// --- grouped (JSON for UI) + CSV export ------------------------------------
router.get("/grouped", async (req, res) => {
    const db = req.app.get("pg");
    const { sql, params } = buildFilters(req.query);

    // Build aggregation so "by" (changed_by) is preserved per pair
    const cte = `
        with base as (
            select
                cl.arrival_date::date                        as arrival_date,
                cl.airline_3d,
                cl.master_bill_no,
                cl.client_name,
                cl.actor_branch                              as branch,
                cl.bad_mid,
                cl.good_mid,
                /* use the logged name if present, otherwise the canonical name */
                coalesce(
                nullif(trim(cl.manufacturer_name), ''),
                nullif(trim(cm.manufacturer_name), '')
                )                                            as manufacturer_name,
                cl.action                                    as method,
                nullif(trim(cl.changed_by), '')              as changed_by
            from midmap.change_log cl
            left join midmap.canonical_manufacturers cm
                on cm.good_mid = cl.good_mid
            -- your WHERE goes here
            ${sql}
            ),
            pairs as (
            select
                arrival_date, airline_3d, master_bill_no, client_name, branch,
                bad_mid, good_mid, manufacturer_name,
                coalesce(changed_by,'') as changed_by,
                min(method) as method,
                count(*) as cnt
            from base
            group by
                arrival_date, airline_3d, master_bill_no, client_name, branch,
                bad_mid, good_mid, manufacturer_name, changed_by
            ),
            shipments as (
            select
                arrival_date,
                (airline_3d || '-' || master_bill_no) as shipment,
                client_name as client,
                branch,
                sum(cnt) as changes_count,
                jsonb_agg(
                jsonb_build_object(
                    'bad_mid', bad_mid,
                    'good_mid', good_mid,
                    'manufacturer_name', coalesce(manufacturer_name, ''),
                    'method', method,
                    'by', changed_by,
                    'count', cnt
                )
                order by bad_mid, good_mid, changed_by
                ) as pairs
            from pairs
            group by arrival_date, airline_3d, master_bill_no, client_name, branch
            )

  `;

    const wantCSV = (req.query.format || "").toLowerCase() === "csv";
    if (!wantCSV) {
        const limit = Math.max(
            1,
            Math.min(500, Number(req.query.limit || 100))
        );
        const offset = Math.max(0, Number(req.query.offset || 0));

        const totalSql = `
      ${cte}
      select count(*)::int as total
        from (select 1 from shipments) t;
    `;
        const dataSql = `
        ${cte}
        select
            to_char(arrival_date, 'YYYY-MM-DD') as arrival_date,
            shipment, client, branch, changes_count, pairs
        from shipments
        order by arrival_date desc, shipment
        limit $${params.length + 1} offset $${params.length + 2};
        `;
        const [tot, data] = await Promise.all([
            db.query(totalSql, params).then((r) => r.rows[0].total),
            db.query(dataSql, [...params, limit, offset]).then((r) => r.rows),
        ]);
        return res.json({ total: tot, limit, offset, rows: data });
    }

    // Human-readable CSV
    const exportSql = `
    ${cte}
    select
        to_char(arrival_date, 'YYYY-MM-DD') as arrival_date,
        shipment, client, branch, changes_count, pairs
    from shipments
    order by arrival_date desc, shipment;
    `;
    const rows = await db.query(exportSql, params).then((r) => r.rows);

    const header = [
        "arrival_date",
        "shipment",
        "client",
        "branch",
        "changes",
        "people",
        "pairs", // e.g. BAD -> GOOD ×3; BAD2 -> GOOD2
    ].join(",");

    const lines = [header];

    rows.forEach((r) => {
        const ppl = uniq(
            (r.pairs || []).map((p) => (p.by || "").trim()).filter(Boolean)
        ).join("; ");
        const pairText = (r.pairs || [])
            .map((p) => {
                const cnt = p.count > 1 ? ` ×${p.count}` : "";
                const left = (p.manufacturer_name || "").trim();
                return left
                    ? `${left}: ${p.bad_mid} -> ${p.good_mid}${cnt}`
                    : `${p.bad_mid} -> ${p.good_mid}${cnt}`;
            })
            .join("; ");


        lines.push(
            [
                csvEsc(r.arrival_date),
                csvEsc(r.shipment),
                csvEsc(r.client || ""),
                csvEsc(r.branch || ""),
                r.changes_count ?? 0,
                csvEsc(ppl),
                csvEsc(pairText),
            ].join(",")
        );
    });

    const out = lines.join("\n");
    res.setHeader(
        "content-disposition",
        `attachment; filename="midmap_report_${Date.now()}.csv"`
    );
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.send(out);
});

module.exports = router;

// --- helpers ----------------------------------------------------------------
function uniq(a) {
    return [...new Set(a)];
}
function csvEsc(v) {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
}
