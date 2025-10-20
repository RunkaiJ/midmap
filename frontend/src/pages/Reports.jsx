import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

function useDebounced(value, ms = 300) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

function CodeChip({ children }) {
    return (
        <span className="badge text-bg-light border fw-normal font-monospace">
            {children || "—"}
        </span>
    );
}

export default function Reports() {
    const [clients, setClients] = useState([]);
    const [branches, setBranches] = useState([]);

    // meta filters
    const [client, setClient] = useState("");
    const [branch, setBranch] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    // column filters
    const [fMawb, setFMawb] = useState("");
    const [fWrong, setFWrong] = useState("");
    const [fCorrect, setFCorrect] = useState("");
    const [fName, setFName] = useState("");
    const [fAddress, setFAddress] = useState("");
    const [fCity, setFCity] = useState("");
    const [fZip, setFZip] = useState("");
    const [fNotes, setFNotes] = useState("");

    // debounced filters
    const dMawb = useDebounced(fMawb);
    const dWrong = useDebounced(fWrong);
    const dCorrect = useDebounced(fCorrect);
    const dName = useDebounced(fName);
    const dAddress = useDebounced(fAddress);
    const dCity = useDebounced(fCity);
    const dZip = useDebounced(fZip);
    const dNotes = useDebounced(fNotes);

    // data
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(100);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    // load meta
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch(`${API}/reports/meta`, {
                    cache: "no-store",
                });
                if (!r.ok) throw new Error(await r.text());
                const j = await r.json();
                if (cancelled) return;
                setClients(Array.isArray(j.clients) ? j.clients : []);
                setBranches(Array.isArray(j.branches) ? j.branches : []);
            } catch (e) {
                if (!cancelled) setErr(`Failed to load filters: ${e.message}`);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // query string
    const qs = useMemo(() => {
        const p = new URLSearchParams();
        if (client) p.set("client", client);
        if (branch) p.set("branch", branch);
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        if (dMawb) p.set("mawb", dMawb);
        if (dWrong) p.set("wrong_mid", dWrong);
        if (dCorrect) p.set("correct_mid", dCorrect);
        if (dName) p.set("name", dName);
        if (dAddress) p.set("address", dAddress);
        if (dCity) p.set("city", dCity);
        if (dZip) p.set("zipcode", dZip);
        if (dNotes) p.set("notes", dNotes);
        p.set("limit", String(limit));
        p.set("offset", String(offset));
        return p.toString();
    }, [
        client,
        branch,
        from,
        to,
        dMawb,
        dWrong,
        dCorrect,
        dName,
        dAddress,
        dCity,
        dZip,
        dNotes,
        limit,
        offset,
    ]);

    // fetch data
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

    const canPrev = offset > 0;
    const canNext = offset + limit < total;

    return (
        <div className="row">
            <div className="col-12">
                <h2 className="mb-3">Reports</h2>

                {/* Filters */}
                <div className="card mb-3">
                    <div className="card-header fw-semibold">Filters</div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label">Client</label>
                                <select
                                    className="form-select"
                                    value={client}
                                    onChange={(e) => {
                                        setClient(e.target.value);
                                        setOffset(0);
                                    }}
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
                                    onChange={(e) => {
                                        setBranch(e.target.value);
                                        setOffset(0);
                                    }}
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
                                    onChange={(e) => {
                                        setFrom(e.target.value);
                                        setOffset(0);
                                    }}
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Arrival To</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={to}
                                    onChange={(e) => {
                                        setTo(e.target.value);
                                        setOffset(0);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {err && <div className="alert alert-danger">{err}</div>}

                {/* Results */}
                <div className="card">
                    <div className="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
                        <div className="fw-semibold">Results</div>
                        <div className="ms-auto d-flex align-items-center gap-3 small text-muted">
                            <span>{total} total</span>
                            <span>showing {rows.length}</span>
                            <span>offset {offset}</span>
                            <a
                                className="btn btn-sm btn-outline-success"
                                href={`${API}/reports/table.xlsx?${qs}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Export Excel
                            </a>
                        </div>
                    </div>

                    <div className="card-body p-0">
                        <ResultsTable
                            rows={rows}
                            loading={loading}
                            filters={{
                                fMawb,
                                setFMawb,
                                fWrong,
                                setFWrong,
                                fCorrect,
                                setFCorrect,
                                fName,
                                setFName,
                                fAddress,
                                setFAddress,
                                fCity,
                                setFCity,
                                fZip,
                                setFZip,
                                fNotes,
                                setFNotes,
                                setOffset,
                            }}
                        />
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

function ResultsTable({ rows, filters, loading }) {
    const {
        fMawb,
        setFMawb,
        fWrong,
        setFWrong,
        fCorrect,
        setFCorrect,
        fName,
        setFName,
        fAddress,
        setFAddress,
        fCity,
        setFCity,
        fZip,
        setFZip,
        fNotes,
        setFNotes,
        setOffset,
    } = filters;

    const onChange = (setter) => (e) => {
        setter(e.target.value);
        setOffset(0);
    };

    return (
        <div className="table-responsive" style={{ maxHeight: "70vh" }}>
            <table className="table table-sm table-striped table-hover align-middle mb-0">
                <thead
                    className="table-light"
                    style={{ position: "sticky", top: 0, zIndex: 1 }}
                >
                    <tr className="align-middle">
                        <th style={{ whiteSpace: "nowrap", width: 160 }}>
                            MAWB
                        </th>
                        <th style={{ width: 180 }}>Wrong MID</th>
                        <th style={{ width: 180 }}>Correct MID</th>
                        <th style={{ minWidth: 260 }}>Name</th>
                        <th style={{ minWidth: 480 }}>Address</th>
                        <th style={{ minWidth: 160 }}>City</th>
                        <th style={{ width: 120 }}>Zipcode</th>
                        <th style={{ minWidth: 200 }}>Notes</th>
                    </tr>
                    <tr>
                        <th>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text">🔎</span>
                                <input
                                    className="form-control"
                                    placeholder="MAWB"
                                    value={fMawb}
                                    onChange={onChange(setFMawb)}
                                />
                            </div>
                        </th>
                        <th>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text">🔎</span>
                                <input
                                    className="form-control"
                                    placeholder="Wrong MID"
                                    value={fWrong}
                                    onChange={onChange(setFWrong)}
                                />
                            </div>
                        </th>
                        <th>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text">🔎</span>
                                <input
                                    className="form-control"
                                    placeholder="Correct MID"
                                    value={fCorrect}
                                    onChange={onChange(setFCorrect)}
                                />
                            </div>
                        </th>
                        <th>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text">🔎</span>
                                <input
                                    className="form-control"
                                    placeholder="Name"
                                    value={fName}
                                    onChange={onChange(setFName)}
                                />
                            </div>
                        </th>
                        <th>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text">🔎</span>
                                <input
                                    className="form-control"
                                    placeholder="Address"
                                    value={fAddress}
                                    onChange={onChange(setFAddress)}
                                />
                            </div>
                        </th>
                        <th>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text">🔎</span>
                                <input
                                    className="form-control"
                                    placeholder="City"
                                    value={fCity}
                                    onChange={onChange(setFCity)}
                                />
                            </div>
                        </th>
                        <th>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text">🔎</span>
                                <input
                                    className="form-control"
                                    placeholder="Zipcode"
                                    value={fZip}
                                    onChange={onChange(setFZip)}
                                />
                            </div>
                        </th>
                        <th>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text">🔎</span>
                                <input
                                    className="form-control"
                                    placeholder="Notes"
                                    value={fNotes}
                                    onChange={onChange(setFNotes)}
                                />
                            </div>
                        </th>
                    </tr>
                </thead>

                <tbody className="table-group-divider">
                    {loading && (
                        <tr>
                            <td colSpan={8} className="text-center py-5">
                                <div
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                ></div>
                                Loading…
                            </td>
                        </tr>
                    )}

                    {!loading && rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={8}
                                className="text-center py-5 text-muted"
                            >
                                No data. Adjust filters to broaden your search.
                            </td>
                        </tr>
                    )}

                    {!loading &&
                        rows.map((r, i) => (
                            <tr key={i}>
                                <td>
                                    <CodeChip>{r.mawb}</CodeChip>
                                </td>
                                <td>
                                    <CodeChip>{r.wrong_mid}</CodeChip>
                                </td>
                                <td>
                                    <CodeChip>{r.correct_mid}</CodeChip>
                                    {r.note ? (
                                        <span className="ms-2 badge rounded-pill text-bg-warning-subtle border">
                                            review
                                        </span>
                                    ) : null}
                                </td>
                                <td className="fw-semibold">{r.name || ""}</td>
                                <td
                                    className="text-body"
                                    style={{ whiteSpace: "normal" }}
                                >
                                    {r.address || ""}
                                </td>
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
