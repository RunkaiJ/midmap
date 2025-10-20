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

    // debounced column filters
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

    // build query string
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

    const canPrev = offset > 0;
    const canNext = offset + limit < total;

    return (
        <div className="row">
            <div className="col-12">
                <h2 className="mb-3">Reports</h2>

                {/* Top filters (meta) */}
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

                        <div className="d-flex gap-2 mt-3">
                            <a
                                className="btn btn-outline-success"
                                href={`${API}/reports/table.xlsx?${qs}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Export Excel
                            </a>
                        </div>
                    </div>
                </div>

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
                    <div className="card-body p-0">
                        <ResultsTable
                            rows={rows}
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
                            loading={loading}
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

    const onFilterChange = (setter) => (e) => {
        setter(e.target.value);
        setOffset(0);
    };

    return (
        <div className="table-responsive" style={{ maxHeight: "70vh" }}>
            <table className="table table-sm align-middle mb-0">
                <thead
                    className="table-light"
                    style={{ position: "sticky", top: 0, zIndex: 1 }}
                >
                    <tr className="align-middle">
                        <th style={{ whiteSpace: "nowrap" }}>MAWB</th>
                        <th>Wrong MID</th>
                        <th>Correct MID</th>
                        <th>Name</th>
                        <th>Address</th>
                        <th>City</th>
                        <th>Zipcode</th>
                        <th>Notes</th>
                    </tr>
                    {/* filter row */}
                    <tr>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="search…"
                                value={fMawb}
                                onChange={onFilterChange(setFMawb)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="search…"
                                value={fWrong}
                                onChange={onFilterChange(setFWrong)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="search…"
                                value={fCorrect}
                                onChange={onFilterChange(setFCorrect)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="search…"
                                value={fName}
                                onChange={onFilterChange(setFName)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="search…"
                                value={fAddress}
                                onChange={onFilterChange(setFAddress)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="search…"
                                value={fCity}
                                onChange={onFilterChange(setFCity)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="search…"
                                value={fZip}
                                onChange={onFilterChange(setFZip)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="search…"
                                value={fNotes}
                                onChange={onFilterChange(setFNotes)}
                            />
                        </th>
                    </tr>
                </thead>
                <tbody className="table-group-divider">
                    {loading && (
                        <tr>
                            <td colSpan={8} className="text-center py-4">
                                Loading…
                            </td>
                        </tr>
                    )}
                    {!loading && rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={8}
                                className="text-center py-4 text-muted"
                            >
                                No data.
                            </td>
                        </tr>
                    )}
                    {!loading &&
                        rows.map((r, i) => (
                            <tr key={i} className={i % 2 ? "table-light" : ""}>
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
                                <td
                                    style={{
                                        maxWidth: 520,
                                        whiteSpace: "normal",
                                    }}
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
