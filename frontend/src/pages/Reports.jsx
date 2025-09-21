import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

export default function Reports() {
    const [clients, setClients] = useState([]);
    const [branches, setBranches] = useState([]); // [{station, port_code, label}]

    // filters
    const [client, setClient] = useState("");
    const [branch, setBranch] = useState(""); // optional now ("" = All branches)
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    // data
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(100);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    // load meta (clients + branches)
    useEffect(() => {
        let cancelled = false;
        const ac = new AbortController();

        (async () => {
            try {
                const r = await fetch(`${API}/reports/meta`, {
                    signal: ac.signal,
                });
                if (!r.ok) throw new Error(await r.text());
                const j = await r.json();
                if (cancelled) return;

                setClients(Array.isArray(j.clients) ? j.clients : []);
                setBranches(Array.isArray(j.branches) ? j.branches : []);
            } catch (e) {
                if (!cancelled && e.name !== "AbortError") {
                    console.error("Failed to load /reports/meta:", e);
                    setErr(`Failed to load filter options: ${e.message}`);
                }
            }
        })();

        return () => {
            cancelled = true;
            ac.abort();
        };
    }, []);

    // build query string for list + csv
    const qs = useMemo(() => {
        const p = new URLSearchParams();
        if (client) p.set("client", client);
        if (branch) p.set("branch", branch); // empty means "all branches"
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        p.set("limit", String(limit));
        p.set("offset", String(offset));
        return p.toString();
    }, [client, branch, from, to, limit, offset]);

    async function load() {
        setLoading(true);
        setErr("");
        try {
            const r = await fetch(`${API}/reports/grouped?${qs}`);
            if (!r.ok) throw new Error(await r.text());
            const j = await r.json();
            setRows(j.rows || []);
            setTotal(j.total || 0);
            setLimit(j.limit || 100);
            setOffset(j.offset || 0);
        } catch (e) {
            setErr(e.message || "Failed to load.");
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }

    // Search button
    const onSearch = async (e) => {
        e.preventDefault();
        setOffset(0);
        await load();
    };

    // paging
    const canPrev = offset > 0;
    const canNext = offset + limit < total;

    // CSV export (always available)
    const csvHref = `${API}/reports/grouped?${qs}&format=csv`;

    // group rows by arrival_date for readable sections
    const grouped = useMemo(() => {
        const m = new Map();
        for (const r of rows) {
            const k = r.arrival_date || "—";
            if (!m.has(k)) m.set(k, []);
            m.get(k).push(r);
        }
        const keys = [...m.keys()].sort((a, b) => {
            if (a === "—") return 1;
            if (b === "—") return -1;
            return a < b ? 1 : a > b ? -1 : 0; // newest first
        });
        return keys.map((k) => ({ date: k, items: m.get(k) }));
    }, [rows]);

    return (
        <div className="row">
            <div className="col-xl-11 col-lg-12">
                <h2 className="mb-3">Reports</h2>

                <form onSubmit={onSearch} className="card mb-3">
                    <div className="card-header fw-semibold">Filters</div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label">Client</label>
                                <select
                                    className="form-select"
                                    value={client}
                                    onChange={(e) => setClient(e.target.value)}
                                >
                                    <option value="">All</option>
                                    {clients.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Branch</label>
                                <select
                                    className="form-select"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                >
                                    <option value="">All</option>
                                    {branches.map((b) => (
                                        <option
                                            key={b.station}
                                            value={b.station}
                                        >
                                            {b.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">
                                    Arrival From
                                </label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Arrival To</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="d-flex gap-2 mt-3">
                            {loading || !branch}
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? "Loading…" : "Search"}
                            </button>
                            <a
                                className={`btn btn-outline-secondary ${
                                    !csvHref ? "disabled" : ""
                                }`}
                                href={csvHref || "#"}
                                onClick={(e) => {
                                    if (!csvHref) e.preventDefault();
                                }}
                            >
                                Export CSV
                            </a>
                        </div>
                    </div>
                </form>

                {err && <div className="alert alert-danger">{err}</div>}

                <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                        <span className="fw-semibold">Results</span>
                        <span className="text-muted small">
                            {total} total • showing {rows.length} • offset{" "}
                            {offset}
                        </span>
                    </div>

                    <div className="card-body">
                        {rows.length === 0 && (
                            <div className="text-muted text-center py-5">
                                No data.
                            </div>
                        )}

                        {grouped.map(({ date, items }) => (
                            <div key={date} className="mb-4">
                                <div className="d-flex align-items-center mb-2">
                                    <div className="fw-semibold me-2">
                                        {date}
                                    </div>
                                    <div className="text-muted small">
                                        • {items.length} shipment
                                        {items.length > 1 ? "s" : ""}
                                    </div>
                                </div>

                                {items.map((r, idx) => (
                                    <ShipmentCard
                                        key={`${date}-${idx}`}
                                        data={r}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>

                    <div className="d-flex justify-content-between align-items-center p-3 border-top">
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            disabled={!canPrev || loading}
                            onClick={() => {
                                if (canPrev) {
                                    setOffset(Math.max(0, offset - limit));
                                    setTimeout(load, 0);
                                }
                            }}
                        >
                            ‹ Prev
                        </button>
                        <div className="text-muted small">
                            Page {Math.floor(offset / limit) + 1} of{" "}
                            {Math.max(1, Math.ceil(total / limit))}
                        </div>
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            disabled={!canNext || loading}
                            onClick={() => {
                                if (canNext) {
                                    setOffset(offset + limit);
                                    setTimeout(load, 0);
                                }
                            }}
                        >
                            Next ›
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ShipmentCard({ data }) {
    const [expanded, setExpanded] = useState(false);
    const pairs = data.pairs || [];
    const max = 8;
    const show = expanded ? pairs : pairs.slice(0, max);
    const more = pairs.length - show.length;

    return (
        <div className="card border-0 shadow-sm mb-2">
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                    <div className="pe-3">
                        <div className="fw-semibold">{data.shipment}</div>
                        <div className="text-muted small">
                            {data.client || "—"} • {data.branch || "—"}
                        </div>
                    </div>
                    <span className="badge rounded-pill text-bg-primary">
                        {data.changes_count} change
                        {data.changes_count === 1 ? "" : "s"}
                    </span>
                </div>

                <div className="mt-2 d-flex flex-wrap gap-2">
                    {show.map((p, i) => (
                        <span
                            key={i}
                            className="badge rounded-pill text-bg-light border"
                        >
                            <code className="me-1">
                                {p.bad_mid} → {p.good_mid}
                            </code>
                            {p.manufacturer_name && (
                                <span className="text-muted small ms-1">
                                    {p.manufacturer_name}
                                </span>
                            )}
                        </span>
                    ))}
                    {more > 0 && !expanded && (
                        <button
                            type="button"
                            className="btn btn-link btn-sm p-0 align-baseline"
                            onClick={() => setExpanded(true)}
                        >
                            Show {more} more…
                        </button>
                    )}
                    {expanded && pairs.length > max && (
                        <button
                            type="button"
                            className="btn btn-link btn-sm p-0 align-baseline"
                            onClick={() => setExpanded(false)}
                        >
                            Collapse
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
