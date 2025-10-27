import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const MODES = {
    SHEIN: "shein",
    BOOHOO_PURE: "boohoo_pure",
    BOOHOO_HYBRID: "boohoo_hybrid",
};

const API = import.meta.env.VITE_API_BASE;

const writeTextCell = (ws, colIndex, row1Based, text) => {
    const addr = XLSX.utils.encode_cell({ c: colIndex, r: row1Based - 1 });
    ws[addr] = { t: "s", v: text };
};

function trimTrailingEmpty(ws) {
    const ref = ws["!ref"] || "A1";
    const range = XLSX.utils.decode_range(ref);
    let R0 = range.s.r,
        C0 = range.s.c,
        R1 = range.e.r,
        C1 = range.e.c;

    while (R1 >= R0) {
        let hasData = false;
        for (let c = C0; c <= C1; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r: R1, c })];
            if (cell && cell.v != null && String(cell.v).trim() !== "") {
                hasData = true;
                break;
            }
        }
        if (hasData) break;
        for (let c = C0; c <= C1; c++)
            delete ws[XLSX.utils.encode_cell({ r: R1, c })];
        R1--;
    }

    while (C1 >= C0) {
        let hasData = false;
        for (let r = R0; r <= R1; r++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c: C1 })];
            if (cell && cell.v != null && String(cell.v).trim() !== "") {
                hasData = true;
                break;
            }
        }
        if (hasData) break;
        for (let r = R0; r <= R1; r++)
            delete ws[XLSX.utils.encode_cell({ r, c: C1 })];
        C1--;
    }

    ws["!ref"] = XLSX.utils.encode_range({
        s: { r: R0, c: C0 },
        e: { r: Math.max(R0, R1), c: Math.max(C0, C1) },
    });
}

function fmtDateCols(ws, ...colIdx) {
    const rng = XLSX.utils.decode_range(ws["!ref"]);
    for (const c of colIdx) {
        for (let r = 1; r <= rng.e.r; r++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            if (cell && typeof cell.v === "number") {
                cell.t = "n";
                cell.z = "m/d/yyyy";
            }
        }
    }
}

const isValidXlsx = (f) => {
    if (!f) return false;
    const nameOk = f.name.toLowerCase().endsWith(".xlsx");
    const typeOk =
        (f.type || "").toLowerCase().includes("spreadsheet") ||
        (f.type || "").toLowerCase().includes("excel");
    return nameOk || typeOk;
};

export default function FixMids() {
    const [file, setFile] = useState(null);
    const [branches, setBranches] = useState([]);
    const [branch, setBranch] = useState("");
    const [person, setPerson] = useState("");
    const [houseHeader, setHouseHeader] = useState("");
    const [status, setStatus] = useState(null);
    const [changesJson, setChangesJson] = useState("");
    const [busy, setBusy] = useState(false);

    const [mode, setMode] = useState(MODES.SHEIN);
    const [airlineInput, setAirlineInput] = useState("");
    const [htsMap, setHtsMap] = useState({});

    useEffect(() => {
        let cancelled = false;
        if (mode === MODES.BOOHOO_PURE || mode === MODES.BOOHOO_HYBRID) {
            (async () => {
                try {
                    const r = await fetch(`${API}/boohoo/hts-map`, {
                        cache: "no-store",
                    });
                    if (!r.ok) return;
                    const j = await r.json();
                    if (!cancelled && j && typeof j === "object") setHtsMap(j);
                } catch (_) {}
            })();
        } else {
            setHtsMap({});
        }
        return () => {
            cancelled = true;
        };
    }, [mode]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch(`${API}/log/meta`);
                const j = await r.json();
                if (cancelled) return;
                const arr = Array.isArray(j.branches) ? j.branches : [];
                setBranches(arr);
            } catch (e) {
                console.error("Failed to load /log/meta:", e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const onFile = async (e) => {
        const f = e.target.files?.[0] || null;
        if (f && !isValidXlsx(f)) {
            setStatus({
                type: "warning",
                text: "Please select a .xlsx Excel file.",
            });
            setFile(null);
            return;
        }
        setFile(f);
        setStatus(null);
        setChangesJson("");

        // auto-detect "House AWB" column name
        try {
            const buf = await f.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];
            const header =
                XLSX.utils
                    .sheet_to_json(ws, { header: 1 })
                    .at(0)
                    ?.map((h) => (h ?? "").toString().trim()) || [];
            const found = header.find((h) =>
                h.toLowerCase().includes("house awb")
            );
            setHouseHeader(found || "");
        } catch {
            setHouseHeader("");
        }
    };

    async function resolvePairs(pairs) {
        const res = await fetch(`${API}/resolve/mids`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: pairs }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { results } = await res.json();
        return results;
    }

    async function logChanges(rows) {
        if (!rows.length) return;
        await fetch(`${API}/log/changes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows, branch, person }),
        }).catch(() => {});
    }

    const processAndDownload = async (e) => {
        e.preventDefault();
        if (!file)
            return setStatus({ type: "warning", text: "Choose a .xlsx file." });
        if (!branch || !person || !houseHeader)
            return setStatus({
                type: "warning",
                text: "Please select a Branch, enter your name, and fill House AWB (required).",
            });

        setBusy(true);
        setStatus({ type: "info", text: "Processing in browser…" });
        setChangesJson("");

        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];

            const header =
                XLSX.utils
                    .sheet_to_json(ws, { header: 1 })
                    .at(0)
                    ?.map((h) => (h ?? "").toString().trim()) || [];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

            const findIdx = (labels) => {
                const lower = header.map((h) => h.toLowerCase());
                for (const lab of labels) {
                    const i = lower.indexOf(lab.toLowerCase());
                    if (i !== -1) return i;
                }
                return -1;
            };

            const idx = {
                airline: findIdx(["Airline 3 digit code"]),
                bill: findIdx(["Master Bill Number"]),
                importer: findIdx(["ImporterID"]),
                airport: findIdx(["Arrival Airport", "ArrivalAirport"]),
                entryDate: findIdx(["EntryDate", "Entry Date"]),
                importDate: findIdx(["ImportDate", "Import Date"]),
                exportDate: findIdx(["Date of Export"]),
                arrivalDate: findIdx(["Arrival Date", "ArrivalDate"]),
                name: findIdx(["ManufacturerName", "Manufacturer Name"]),
                mid: findIdx(["ManufacturerCode", "Manufacturer Code"]),
                house: findIdx([houseHeader]),
                fda: findIdx(["FDAPRODUCTCODE"]),
                hts: findIdx(["HTS"]),
            };

            if (idx.house === -1)
                throw new Error(
                    `Could not find a column named "${houseHeader}".`
                );

            // (rest of your existing processAndDownload logic unchanged)
            // ...
        } catch (err) {
            setStatus({
                type: "danger",
                text: err.message || "Failed to process.",
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="row">
            <div className="col-xl-8 col-lg-9">
                <h2 className="mb-3">Fix Mids (Excel Upload)</h2>

                {status && (
                    <div className={`alert alert-${status.type}`}>
                        {status.text}
                    </div>
                )}

                <form onSubmit={processAndDownload} className="card mb-3">
                    <div className="card-header fw-semibold">Upload</div>
                    <div className="card-body">
                        <div className="mb-3">
                            <label className="form-label">
                                Source file (.xlsx)
                            </label>
                            <input
                                className="form-control"
                                type="file"
                                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                onChange={onFile}
                            />
                            {file && (
                                <div className="form-text">
                                    Selected: {file.name} (
                                    {Math.round(file.size / 1024)} KB)
                                </div>
                            )}
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col-md-6">
                                <label className="form-label">Mode</label>
                                <select
                                    className="form-select"
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value)}
                                >
                                    <option value={MODES.SHEIN}>SHEIN</option>
                                    <option value={MODES.BOOHOO_PURE}>
                                        BOOHOO — Pure
                                    </option>
                                    <option value={MODES.BOOHOO_HYBRID}>
                                        BOOHOO — Hybrid
                                    </option>
                                </select>
                            </div>
                            {mode === MODES.BOOHOO_HYBRID && (
                                <div className="col-md-6">
                                    <label className="form-label">
                                        Airline 3 digit code
                                    </label>
                                    <input
                                        className="form-control"
                                        placeholder="e.g. 235"
                                        value={airlineInput}
                                        onChange={(e) =>
                                            setAirlineInput(e.target.value)
                                        }
                                    />
                                </div>
                            )}
                        </div>

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
                                    <option value="">Select…</option>
                                    {branches.map((b) => (
                                        <option
                                            key={b.station}
                                            value={b.station}
                                        >
                                            {b.label ||
                                                `${b.station}${
                                                    b.port_code
                                                        ? ` | ${b.port_code}`
                                                        : ""
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
                            <div className="col-md-6">
                                <label className="form-label">
                                    House AWB (required)
                                </label>
                                <input
                                    className="form-control"
                                    placeholder='e.g. "House AWB"'
                                    value={houseHeader}
                                    onChange={(e) =>
                                        setHouseHeader(e.target.value)
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="d-flex gap-2 mt-3">
                            <button
                                className="btn btn-primary"
                                disabled={
                                    !file ||
                                    busy ||
                                    !branch ||
                                    !person ||
                                    !houseHeader
                                }
                            >
                                {busy ? "Processing…" : "Process & Download"}
                            </button>
                            <button
                                className="btn btn-outline-secondary"
                                type="button"
                                onClick={() => {
                                    setFile(null);
                                    setStatus(null);
                                    setChangesJson("");
                                    setBusy(false);
                                    setHouseHeader("");
                                }}
                                disabled={busy}
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </form>

                <div className="card">
                    <div className="card-header fw-semibold">
                        Unique changes (for this file)
                    </div>
                    <div className="card-body">
                        {!changesJson ? (
                            <p className="text-muted mb-0">No result yet.</p>
                        ) : (
                            <pre
                                className="small mb-0"
                                style={{ maxHeight: 280, overflow: "auto" }}
                            >
                                {changesJson}
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function csvEsc(v) {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
}
