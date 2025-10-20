import React, { useEffect, useMemo, useState } from "react";
import "./reports.css"; // ⬅️ NEW: bring in styles

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

    const [client, setClient] = useState("");
    const [branch, setBranch] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const [fMawb, setFMawb] = useState("");
    const [fWrong, setFWrong] = useState("");
    const [fCorrect, setFCorrect] = useState("");
    const [fName, setFName] = useState("");
    const [fAddress, setFAddress] = useState("");
    const [fCity, setFCity] = useState("");
    const [fZip, setFZip] = useState("");

    const dMawb = useDebounced(fMawb);
    const dWrong = useDebounced(fWrong);
    const dCorrect = useDebounced(fCorrect);
    const dName = useDebounced(fName);
    const dAddress = useDebounced(fAddress);
    const dCity = useDebounced(fCity);
    const dZip = useDebounced(fZip);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(100);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

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
        limit,
        offset,
    ]);

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
        setOffset,
    } = filters;

    const [widths, setWidths] = useState([160, 180, 180, 280, 520, 180, 120]);
    const [drag, setDrag] = useState(null);

    const startResize = (idx, e) => {
        setDrag({ index: idx, startX: e.clientX, startW: widths[idx] });
        e.preventDefault();
        e.stopPropagation();
    };

    useEffect(() => {
        if (!drag) return;
        const onMove = (e) => {
            const delta = e.clientX - drag.startX;
            const next = [...widths];
            next[drag.index] = Math.max(80, drag.startW + delta);
            setWidths(next);
        };
        const onUp = () => setDrag(null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp, { once: true });
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [drag, widths]);

    const onChange = (setter) => (e) => {
        setter(e.target.value);
        setOffset(0);
    };

    return (
        <div className="table-responsive table-wrap">
            <table className="table table-sm table-hover align-middle mb-0 table-fixed">
                <colgroup>
                    {widths.map((w, i) => (
                        <col key={i} style={{ width: w }} />
                    ))}
                </colgroup>

                <thead className="table-light header-sticky">
                    <tr className="align-middle">
                        {[
                            "MAWB",
                            "Wrong MID",
                            "Correct MID",
                            "Name",
                            "Address",
                            "City",
                            "Zipcode",
                        ].map((label, i) => (
                            <th key={label} className="th-resizable">
                                <div className="d-flex align-items-center justify-content-between">
                                    <span className="fw-semibold th-label">
                                        {label}
                                    </span>
                                </div>
                                <span
                                    className="th-resize-handle"
                                    onMouseDown={(e) => startResize(i, e)}
                                    title="Drag to resize"
                                />
                            </th>
                        ))}
                    </tr>

                    <tr>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="MAWB"
                                value={fMawb}
                                onChange={onChange(setFMawb)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="Wrong MID"
                                value={fWrong}
                                onChange={onChange(setFWrong)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="Correct MID"
                                value={fCorrect}
                                onChange={onChange(setFCorrect)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="Name"
                                value={fName}
                                onChange={onChange(setFName)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="Address"
                                value={fAddress}
                                onChange={onChange(setFAddress)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="City"
                                value={fCity}
                                onChange={onChange(setFCity)}
                            />
                        </th>
                        <th>
                            <input
                                className="form-control form-control-sm"
                                placeholder="Zipcode"
                                value={fZip}
                                onChange={onChange(setFZip)}
                            />
                        </th>
                    </tr>
                </thead>

                <tbody className="table-group-divider">
                    {loading && (
                        <tr>
                            <td colSpan={7} className="text-center py-5">
                                <div
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                />
                                Loading…
                            </td>
                        </tr>
                    )}

                    {!loading && rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={7}
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
                                    <span
                                        className="badge badge-soft code-chip cell-trunc w-100 d-inline-block"
                                        title={r.mawb || ""}
                                    >
                                        {r.mawb || "—"}
                                    </span>
                                </td>
                                <td>
                                    <span
                                        className="badge badge-soft code-chip cell-trunc w-100 d-inline-block"
                                        title={r.wrong_mid || ""}
                                    >
                                        {r.wrong_mid || "—"}
                                    </span>
                                </td>
                                <td>
                                    <span
                                        className="badge badge-soft code-chip cell-trunc w-100 d-inline-block"
                                        title={r.correct_mid || ""}
                                    >
                                        {r.correct_mid || "—"}
                                    </span>
                                </td>
                                <td
                                    className="fw-semibold cell-trunc"
                                    title={r.name || ""}
                                >
                                    {r.name || ""}
                                </td>
                                <td
                                    className="cell-trunc"
                                    title={r.address || ""}
                                >
                                    {r.address || ""}
                                </td>
                                <td className="cell-trunc" title={r.city || ""}>
                                    {r.city || ""}
                                </td>
                                <td
                                    className="cell-trunc"
                                    title={r.zipcode || ""}
                                >
                                    {r.zipcode || ""}
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}
