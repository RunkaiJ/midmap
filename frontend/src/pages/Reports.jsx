import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

export default function Reports() {
    const [clients, setClients] = useState([]);
    const [branches, setBranches] = useState([]);

    const excelHref = `${API}/reports/table.xlsx?${qs}`;

    // filters
    const [client, setClient] = useState("");
    const [branch, setBranch] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    // data & paging
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(100);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    // load filter options
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

    // build query string
    const qs = useMemo(() => {
        const p = new URLSearchParams();
        if (client) p.set("client", client);
        if (branch) p.set("branch", branch);
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        p.set("limit", String(limit));
        p.set("offset", String(offset));
        return p.toString();
    }, [client, branch, from, to, limit, offset]);

    // fetch data whenever qs changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr("");
            try {
                const r = await fetch(`${API}/reports/table?${qs}`, {
                    cache: "no-store",
                });
                if (!r.ok) throw new Error(await r.text());
                const j = await r.json();
                if (cancelled) return;
                setRows(j.rows || []);
                setTotal(j.total || 0);
                setLimit(j.limit || 100);
                setOffset(j.offset || 0);
            } catch (e) {
                if (!cancelled) {
                    setErr(e.message || "Failed to load.");
                    setRows([]);
                    setTotal(0);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [qs]);

    const onSearch = (e) => {
        e.preventDefault();
        setOffset(0);
    };
    const canPrev = offset > 0;
    const canNext = offset + limit < total;

    return (
        <div className="row">
            <div className="col-xl-11 col-lg-12">
                <h2 className="mb-3">Reports</h2>

                {/* Filters */}
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
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? "Loading…" : "Search"}
                            </button>
                            <a
                                className="btn btn-outline-success"
                                href={excelHref}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Export Excel
                            </a>
                        </div>
                    </div>
                </form>

                {err && <div className="alert alert-danger">{err}</div>}

                {/* Results */}
                <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                        <span className="fw-semibold">Results</span>
                        <span className="text-muted small">
                            {total} total • showing {rows.length} • offset{" "}
                            {offset}
                        </span>
                    </div>
                    <div className="card-body">
                        <ResultsTable rows={rows} />
                    </div>
                    <div className="d-flex justify-content-between align-items-center p-3 border-top">
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            disabled={!canPrev || loading}
                            onClick={() =>
                                canPrev &&
                                setOffset(Math.max(0, offset - limit))
                            }
                        >
                            ‹ Prev
                        </button>
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            disabled={!canNext || loading}
                            onClick={() => canNext && setOffset(offset + limit)}
                        >
                            Next ›
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ResultsTable({ rows }) {
    if (!rows.length) {
        return <div className="text-muted text-center py-5">No data.</div>;
    }
    return (
        <div className="table-responsive">
            <table className="table table-sm align-middle">
                <thead>
                    <tr>
                        <th>MAWB</th>
                        <th>Wrong MID</th>
                        <th>Correct MID</th>
                        <th>Name</th>
                        <th>Address</th>
                        <th>City</th>
                        <th>Zipcode</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            <td>
                                <code>{r.mawb || "—"}</code>
                            </td>
                            <td>
                                <code>{r.wrong_mid || "—"}</code>
                            </td>
                            <td>
                                <code>{r.correct_mid || "—"}</code>
                            </td>
                            <td>{r.name || ""}</td>
                            <td>{r.address || ""}</td>
                            <td>{r.city || ""}</td>
                            <td>{r.zipcode || ""}</td>
                            <td className="text-muted">{r.note || ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
