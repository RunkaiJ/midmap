import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

/* ---------------- helpers ---------------- */
const clean = (s) => (s ?? "").toString().trim();
const up = (s) => clean(s).toUpperCase();

function unquote(s) {
    const t = clean(s);
    if (
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
    ) {
        return t.slice(1, -1).trim();
    }
    return t;
}

/** Triplets: bad_mid, manufacturer_name, good_mid (comma or TAB) */
function parseTripletLines(text) {
    const lines = (text || "").split("\n");
    const valid = [],
        invalid = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (!raw) continue;

        const lastTab = raw.lastIndexOf("\t");
        const delim = lastTab > -1 ? "\t" : ",";

        const last = raw.lastIndexOf(delim);
        if (last === -1) {
            invalid.push({
                line: i + 1,
                raw,
                reason: "Need bad_mid,manufacturer_name,good_mid",
            });
            continue;
        }
        const left = raw.slice(0, last);
        const good_mid = clean(raw.slice(last + 1));
        if (!good_mid) {
            invalid.push({ line: i + 1, raw, reason: "Missing good_mid" });
            continue;
        }

        const first = left.indexOf(delim);
        if (first === -1) {
            invalid.push({
                line: i + 1,
                raw,
                reason: "Missing manufacturer_name",
            });
            continue;
        }

        const bad_mid = clean(left.slice(0, first));
        const manufacturer_name = unquote(left.slice(first + 1));
        if (!bad_mid || !manufacturer_name) {
            invalid.push({
                line: i + 1,
                raw,
                reason: "Missing bad_mid or manufacturer_name",
            });
            continue;
        }
        valid.push({ bad_mid, manufacturer_name, good_mid });
    }
    return { valid, invalid };
}

/** Aliases: bad_mid, good_mid (comma or TAB) */
function parseAliasLines(text) {
    const lines = (text || "").split("\n");
    const valid = [],
        invalid = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (!raw) continue;
        const parts = raw.split(/\t|,/).map((p) => clean(p));
        if (parts.length < 2) {
            invalid.push({ line: i + 1, raw, reason: "Need bad_mid,good_mid" });
            continue;
        }
        const bad_mid = parts[0];
        const good_mid = parts[parts.length - 1];
        if (!bad_mid || !good_mid) {
            invalid.push({
                line: i + 1,
                raw,
                reason: "Missing bad_mid or good_mid",
            });
            continue;
        }
        valid.push({ bad_mid, good_mid });
    }
    return { valid, invalid };
}

/** Names: manufacturer_name, good_mid (split on last delimiter so commas in names work) */
function parseNameLines(text) {
    const lines = (text || "").split("\n");
    const valid = [],
        invalid = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (!raw) continue;
        let pos = raw.lastIndexOf("\t");
        if (pos === -1) pos = raw.lastIndexOf(",");
        if (pos === -1) {
            invalid.push({
                line: i + 1,
                raw,
                reason: "Need manufacturer_name,good_mid",
            });
            continue;
        }
        const manufacturer_name = unquote(raw.slice(0, pos));
        const good_mid = clean(raw.slice(pos + 1));
        if (!manufacturer_name || !good_mid) {
            invalid.push({
                line: i + 1,
                raw,
                reason: "Missing name or good_mid",
            });
            continue;
        }
        valid.push({ manufacturer_name, good_mid });
    }
    return { valid, invalid };
}

/* ---------------- page ---------------- */
export default function AddMids() {
    // filter “who”
    const [branches, setBranches] = useState([]); // [{station, port_code, label}]
    const [branch, setBranch] = useState("");
    const [person, setPerson] = useState("");

    // single-mode input
    // 'triplet' | 'alias' | 'name'
    const [mode, setMode] = useState("triplet");
    const [bulkText, setBulkText] = useState("");

    // status
    const [status, setStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState([]);

    // fetch branches once (reuse /reports/meta to stay DRY)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch(`${API}/reports/meta`);
                const j = await r.json();
                if (cancelled) return;
                const list = Array.isArray(j.branches) ? j.branches : [];
                setBranches(list); 
            } catch (e) {
                if (!cancelled) {
                    setStatus({
                        type: "danger",
                        text: `Failed to load branches: ${e.message}`,
                    });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // parsing & preview
    const parsed = useMemo(() => {
        if (mode === "triplet") return parseTripletLines(bulkText);
        if (mode === "alias") return parseAliasLines(bulkText);
        return parseNameLines(bulkText);
    }, [mode, bulkText]);

    const columns = useMemo(() => {
        if (mode === "triplet")
            return ["bad_mid", "manufacturer_name", "good_mid"];
        if (mode === "alias") return ["bad_mid", "good_mid"];
        return ["manufacturer_name", "good_mid"];
    }, [mode]);

    const example = useMemo(() => {
        if (mode === "triplet")
            return "CNDONDIN501DON, Dongguan Shanjia Clothing Co., Ltd., CNDONSHA800DON";
        if (mode === "alias") return "CNDONDIN501DON, CNDONSHA800DON";
        return "Dongguan Shanjia Clothing Co., Ltd., CNDONSHA800DON";
    }, [mode]);

    const canSave =
        branch && person.trim() && parsed.valid.length > 0 && !saving;

    // de-duplicate before sending (normalize for key)
    function uniqueRows(rows) {
        const seen = new Set();
        const out = [];
        for (const r of rows) {
            let key = "";
            if (mode === "triplet") {
                key = `${up(r.bad_mid)}||${clean(r.manufacturer_name)}||${up(
                    r.good_mid
                )}`;
                out.push({
                    bad_mid: up(r.bad_mid),
                    manufacturer_name: clean(r.manufacturer_name),
                    good_mid: up(r.good_mid),
                });
            } else if (mode === "alias") {
                key = `${up(r.bad_mid)}||${up(r.good_mid)}`;
                out.push({ bad_mid: up(r.bad_mid), good_mid: up(r.good_mid) });
            } else {
                key = `${clean(r.manufacturer_name)}||${up(r.good_mid)}`;
                out.push({
                    manufacturer_name: clean(r.manufacturer_name),
                    good_mid: up(r.good_mid),
                });
            }
            if (!seen.has(key)) {
                seen.add(key);
            } else {
                // drop duplicate (by not pushing again)
                out.pop();
            }
        }
        return out;
    }

    async function onSave(e) {
        e.preventDefault();
        if (!canSave) {
            setStatus({
                type: "warning",
                text: "Select Branch, enter Person, and paste at least one valid line.",
            });
            return;
        }

        setSaving(true);
        setStatus({ type: "info", text: "Saving…" });

        try {
            const rows = uniqueRows(parsed.valid);
            const payload = {
                actor_branch: branch, // required for global logging
                changed_by: person, // required for global logging
                rows,
            };

            let url = `${API}/mids/triplets/bulk`;
            if (mode === "alias") url = `${API}/mids/aliases/bulk`;
            if (mode === "name") url = `${API}/mids/names/bulk`;

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            setStatus({
                type: "success",
                text:
                    mode === "triplet"
                        ? `Saved ${data.inserted} triplet${
                              data.inserted === 1 ? "" : "s"
                          }.`
                        : mode === "alias"
                        ? `Saved ${data.inserted} alias${
                              data.inserted === 1 ? "" : "es"
                          }.`
                        : `Saved ${data.inserted} name mapping${
                              data.inserted === 1 ? "" : "s"
                          }.`,
            });

            setHistory((h) =>
                [
                    {
                        ts: new Date().toISOString(),
                        mode,
                        count: rows.length,
                        branch,
                        person,
                    },
                    ...h,
                ].slice(0, 8)
            );
            // keep bulkText so user can tweak; uncomment to clear:
            // setBulkText("");
        } catch (err) {
            setStatus({
                type: "danger",
                text: err.message || "Failed to save mappings.",
            });
        } finally {
            setSaving(false);
        }
    }

    const resetAll = () => {
        setMode("triplet");
        setBulkText("");
        setStatus(null);
        setSaving(false);
        // keep selected branch intentionally
    };

    return (
        <div className="row">
            <div className="col-xl-9 col-lg-10">
                <h2 className="mb-3">Add MIDs (Global)</h2>
                <p className="text-muted">
                    Update the global mapping used by Fix Mids. We log these as{" "}
                    <em>global</em> actions (by Branch/Person) so reports can
                    include who added them.
                </p>

                {status && (
                    <div className={`alert alert-${status.type}`}>
                        {status.text}
                    </div>
                )}

                {/* Who */}
                <div className="card mb-3">
                    <div className="card-header fw-semibold">By whom</div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label">
                                    Branch (required)
                                </label>
                                <select
                                    className="form-select"
                                    value={branch}
                                    onChange={(e) => setBranch(e.target.value)}
                                    required
                                >
                                    {!branch && (
                                        <option value="">Select…</option>
                                    )}
                                    {branches.map((b) => (
                                        <option
                                            key={b.station}
                                            value={b.station}
                                        >
                                            {b.label ||
                                                `${b.station} | ${
                                                    b.port_code || ""
                                                }`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">
                                    Person (required)
                                </label>
                                <input
                                    className="form-control"
                                    value={person}
                                    onChange={(e) => setPerson(e.target.value)}
                                    placeholder="e.g. Jane Doe"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mode + input */}
                <form onSubmit={onSave} className="card mb-3">
                    <div className="card-header fw-semibold">Add mappings</div>
                    <div className="card-body">
                        <ul className="nav nav-pills mb-3">
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link ${
                                        mode === "triplet" ? "active" : ""
                                    }`}
                                    onClick={() => setMode("triplet")}
                                >
                                    Triplets (bad_mid, name → good_mid)
                                </button>
                            </li>
                            <li className="nav-item ms-2">
                                <button
                                    type="button"
                                    className={`nav-link ${
                                        mode === "alias" ? "active" : ""
                                    }`}
                                    onClick={() => setMode("alias")}
                                >
                                    Aliases (bad_mid → good_mid)
                                </button>
                            </li>
                            <li className="nav-item ms-2">
                                <button
                                    type="button"
                                    className={`nav-link ${
                                        mode === "name" ? "active" : ""
                                    }`}
                                    onClick={() => setMode("name")}
                                >
                                    Names (name → good_mid)
                                </button>
                            </li>
                        </ul>

                        <div className="mb-2 fw-semibold">
                            {mode === "triplet"
                                ? "Triplets: bad_mid, manufacturer_name → good_mid"
                                : mode === "alias"
                                ? "Aliases: bad_mid → good_mid"
                                : "Names: manufacturer_name → good_mid"}
                        </div>

                        <div className="mb-3">
                            <label className="form-label">
                                Paste lines (one per row)
                            </label>
                            <textarea
                                className="form-control"
                                rows={6}
                                placeholder={
                                    mode === "triplet"
                                        ? "bad_mid, manufacturer_name, good_mid (TAB or comma; names can contain commas)"
                                        : mode === "alias"
                                        ? "bad_mid, good_mid (TAB or comma)"
                                        : "manufacturer_name, good_mid (TAB or comma; names can contain commas)"
                                }
                                value={bulkText}
                                onChange={(e) => setBulkText(e.target.value)}
                            />
                            <div className="form-text">
                                Example: <code>{example}</code>
                            </div>
                        </div>

                        <Preview
                            title="Preview"
                            rows={parsed.valid}
                            invalid={parsed.invalid}
                            columns={columns}
                        />

                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-primary"
                                disabled={!canSave}
                            >
                                {saving
                                    ? "Saving…"
                                    : `Save ${
                                          parsed.valid.length || ""
                                      } mapping${
                                          parsed.valid.length === 1 ? "" : "s"
                                      }`}
                            </button>
                            <button
                                className="btn btn-outline-secondary"
                                type="button"
                                onClick={resetAll}
                                disabled={saving}
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </form>

                {/* Recent (local only) */}
                <div className="card">
                    <div className="card-header fw-semibold">
                        Recent (this session)
                    </div>
                    <div className="card-body">
                        {history.length === 0 && (
                            <p className="text-muted mb-0">
                                No recent actions yet.
                            </p>
                        )}
                        {history.length > 0 && (
                            <ul className="list-group">
                                {history.map((h, i) => (
                                    <li key={i} className="list-group-item">
                                        <div className="d-flex justify-content-between">
                                            <div>
                                                <div>
                                                    <strong>
                                                        {h.mode === "triplet"
                                                            ? "Triplets"
                                                            : h.mode === "alias"
                                                            ? "Aliases"
                                                            : "Names"}
                                                    </strong>{" "}
                                                    — {h.count} row(s)
                                                </div>
                                                <div className="text-muted small">
                                                    By {h.person} @ {h.branch}
                                                </div>
                                            </div>
                                            <div className="text-muted small">
                                                {new Date(
                                                    h.ts
                                                ).toLocaleString()}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------------- tiny preview table ---------------- */
function Preview({ title, rows, invalid, columns }) {
    const max = 8;
    const show = rows.slice(0, max);
    return (
        <>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="fw-semibold">{title}</div>
                <div className="text-muted small">
                    {rows.length} valid
                    {rows.length > max ? ` (showing ${max})` : ""}
                    {invalid.length ? ` • ${invalid.length} invalid` : ""}
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="text-muted mb-3">
                    No valid rows detected yet.
                </div>
            ) : (
                <div className="table-responsive mb-3">
                    <table className="table table-sm align-middle">
                        <thead>
                            <tr>
                                {columns.map((c) => (
                                    <th key={c}>{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {show.map((r, i) => (
                                <tr key={i}>
                                    {columns.map((c) => (
                                        <td key={c}>
                                            <code>{r[c]}</code>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {invalid.length > 0 && (
                <details className="mb-3">
                    <summary>Show invalid lines</summary>
                    <ul className="small mt-2">
                        {invalid.map((x, i) => (
                            <li key={i}>
                                <code>line {x.line}:</code> {x.reason} —{" "}
                                <code>{x.raw}</code>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </>
    );
}
