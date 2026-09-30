import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import codeCorrections from "../data/code_corrections.json";
import { readWorksheet, writeRowText, midPairKey, cleanDescriptionColumns } from "../lib/worksheet.js";

const MODES = {
    SHEIN: "shein",
    BOOHOO_PURE: "boohoo_pure",
    BOOHOO_HYBRID: "boohoo_hybrid",
};

const API = import.meta.env.VITE_API_BASE;

function trimTrailingEmpty(ws) {
    const ref = ws["!ref"] || "A1";
    const range = XLSX.utils.decode_range(ref);
    let R0 = range.s.r,
        C0 = range.s.c,
        R1 = range.e.r,
        C1 = range.e.c;

    // trim empty rows bottom
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
        for (let c = C0; c <= C1; c++) {
            delete ws[XLSX.utils.encode_cell({ r: R1, c })];
        }
        R1--;
    }

    // trim empty cols right
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
        for (let r = R0; r <= R1; r++) {
            delete ws[XLSX.utils.encode_cell({ r, c: C1 })];
        }
        C1--;
    }

    ws["!ref"] = XLSX.utils.encode_range({
        s: { r: R0, c: C0 },
        e: { r: Math.max(R0, R1), c: Math.max(C0, C1) },
    });
}

// format numeric Excel date serials to m/d/yyyy in specified columns
function fmtDateCols(ws, ...colIdx) {
    const rng = XLSX.utils.decode_range(ws["!ref"]);
    for (const c of colIdx.filter((c) => c >= 0)) {
        for (let r = rng.s.r + 1; r <= rng.e.r; r++) {
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

    // Branch / person (required)
    const [branches, setBranches] = useState([]);
    const [branch, setBranch] = useState("");
    const [person, setPerson] = useState("");

    // House AWB value (used only for SHEIN mode)
    const [houseAwb, setHouseAwb] = useState("");

    const [status, setStatus] = useState(null);
    const [changesJson, setChangesJson] = useState("");
    const [busy, setBusy] = useState(false);

    // Boohoo bits
    const [mode, setMode] = useState(MODES.SHEIN);
    const [airlineInput, setAirlineInput] = useState(""); // hybrid only
    // load branches for select
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

    // when user picks a file:
    // - validate .xlsx
    // - load first sheet header/rows
    // - find "House AWB"/"HAWB"/"HouseAWB"
    // - grab first non-empty cell under that column and set houseAwb (SHEIN only)
    const onFile = async (e) => {
        const f = e.target.files?.[0] || null;
        if (f && !isValidXlsx(f)) {
            setStatus({
                type: "warning",
                text: "Please select a .xlsx Excel file.",
            });
            setFile(null);
            setHouseAwb("");
            return;
        }

        setFile(f);
        setStatus(null);
        setChangesJson("");

        if (mode === MODES.SHEIN) {
            setHouseAwb("");
        }

        if (!f) return;

        try {
            const buf = await f.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];

            const { header: headerRow, rows: inputRows } = readWorksheet(ws);

            // helper: find index of a header by label(s)
            const findIdx = (labels) => {
                const lower = headerRow.map((h) => h.toLowerCase());
                for (const lab of labels) {
                    const i = lower.indexOf(lab.toLowerCase());
                    if (i !== -1) return i;
                }
                return -1;
            };

            if (mode === MODES.SHEIN) {
                const houseColIdx = findIdx(["House AWB", "HAWB", "HouseAWB"]);

                if (houseColIdx !== -1) {
                    const first = inputRows.find((row) =>
                        String(row[headerRow[houseColIdx]] ?? "").trim() !== "");
                    if (first) setHouseAwb(String(first[headerRow[houseColIdx]]).trim());
                } else {
                    setHouseAwb("");
                }
            }
        } catch (err) {
            console.error("Failed to sniff House AWB:", err);
            if (mode === MODES.SHEIN) {
                setHouseAwb("");
            }
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
        return results; // [{bad_mid, manufacturer_name, good_mid, method}]
    }

    async function logChanges(rows) {
        if (!rows.length) return;
        const response = await fetch(`${API}/log/changes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rows,
                branch,
                person,
            }),
        });
        if (!response.ok) throw new Error("Audit log could not be saved. Please retry processing the file.");
    }

    const processAndDownload = async (e) => {
        e.preventDefault();
        if (!file)
            return setStatus({
                type: "warning",
                text: "Choose a .xlsx file.",
            });

        if (!branch || !person)
            return setStatus({
                type: "warning",
                text: "Please select a Branch and enter your name.",
            });

        if (mode === MODES.SHEIN && !houseAwb)
            return setStatus({
                type: "warning",
                text: "House AWB (required for SHEIN) is empty. Please enter it.",
            });

        setBusy(true);
        setStatus({ type: "info", text: "Processing in browser…" });
        setChangesJson("");

        try {
            // read workbook for processing
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];

            const { header, rows } = readWorksheet(ws);
            if (!rows.length) throw new Error("The first worksheet has no data rows.");
            cleanDescriptionColumns(ws, header, rows);

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
                house: findIdx(["House AWB", "HAWB", "HouseAWB"]),
                fda: findIdx(["FDAPRODUCTCODE"]),
                hts: findIdx(["HTS"]),
            };

            if (idx.mid === -1)
                throw new Error("Could not find ManufacturerCode column.");
            if (idx.airline === -1 || idx.bill === -1)
                throw new Error(
                    "Need Airline 3 digit code and Master Bill Number columns.",
                );
            if (mode === MODES.SHEIN && idx.house === -1)
                throw new Error(
                    'Could not find "House AWB" column in this file.',
                );

            // build unique (bad_mid, manufacturer_name)
            const uniqKey = midPairKey;
            const uniquePairs = new Map();
            for (const r of rows) {
                const bad_mid = (r[header[idx.mid]] ?? "").toString().trim();
                const manufacturer_name =
                    idx.name === -1
                        ? ""
                        : (r[header[idx.name]] ?? "").toString().trim();
                const key = uniqKey(bad_mid, manufacturer_name);
                if (!uniquePairs.has(key))
                    uniquePairs.set(key, { bad_mid, manufacturer_name });
            }

            const resolved = await resolvePairs(
                Array.from(uniquePairs.values()),
            );
            const resMap = new Map(
                resolved.map((x) => [
                    uniqKey(x.bad_mid, x.manufacturer_name),
                    x,
                ]),
            );

            // apply replacements / collect audit rows
            const counts = new Map();
            const changeRows = [];

            rows.forEach((r) => {
                const bad_mid = (r[header[idx.mid]] ?? "").toString().trim();
                const manufacturer_name =
                    idx.name === -1
                        ? ""
                        : (r[header[idx.name]] ?? "").toString().trim();
                const hit = resMap.get(uniqKey(bad_mid, manufacturer_name));

                if (hit && hit.good_mid && hit.good_mid !== bad_mid) {
                    writeRowText(ws, idx.mid, r, hit.good_mid);

                    const k = `${hit.bad_mid}-->${hit.good_mid}||${manufacturer_name}`;
                    counts.set(k, (counts.get(k) || 0) + 1);

                    changeRows.push({
                        airline_3d: (r[header[idx.airline]] ?? "")
                            .toString()
                            .slice(0, 3),
                        master_bill_no: (r[header[idx.bill]] ?? "").toString(),
                        importer_id:
                            idx.importer === -1
                                ? null
                                : (r[header[idx.importer]] ?? "").toString(),
                        arrival_airport:
                            idx.airport === -1
                                ? null
                                : (r[header[idx.airport]] ?? "").toString(),
                        arrival_date:
                            idx.arrivalDate === -1
                                ? null
                                : (r[header[idx.arrivalDate]] ?? "").toString(),
                        manufacturer_name,
                        bad_mid,
                        good_mid: hit.good_mid,
                        method: hit.method, // "alias" or "name"
                    });
                }
            });

            // HOUSE AWB HANDLING
            if (idx.house !== -1) {
                const houseCol = idx.house;

                if (mode === MODES.SHEIN) {
                    // SHEIN: force every row's House AWB cell to match the confirmed houseAwb.
                    rows.forEach((r) => {
                        let valueToWrite = houseAwb;
                        if (!valueToWrite && idx.bill !== -1) {
                            // super defensive fallback
                            valueToWrite = (r[header[idx.bill]] ?? "")
                                .toString()
                                .trim();
                        }
                        if (valueToWrite) {
                            writeRowText(ws, houseCol, r, valueToWrite);
                        }
                    });
                } else {
                    // Boohoo modes: fill blanks in House AWB with Master Bill Number
                    if (idx.bill !== -1) {
                        rows.forEach((r) => {
                            const currentVal = (r[header[houseCol]] ?? "")
                                .toString()
                                .trim();
                            if (!currentVal) {
                                const bill = (r[header[idx.bill]] ?? "")
                                    .toString()
                                    .trim();
                                if (bill) {
                                    writeRowText(ws, houseCol, r, bill);
                                }
                            }
                        });
                    }
                }
            }

            // FDAPRODUCTCODE FIXUPS (step 1: codeCorrections map → direct swap)
            if (idx.fda !== -1) {
                const fdaKey = header[idx.fda];
                rows.forEach((r) => {
                    let raw = r[fdaKey];
                    if (raw == null) return;

                    // exact match lookup after trim
                    const trimmed = String(raw).trim();
                    const corrected = codeCorrections[trimmed];
                    if (corrected) {
                        // write corrected code into sheet + rows[]
                        writeRowText(ws, idx.fda, r, corrected);
                        r[fdaKey] = corrected;
                    }
                });
            }

            // FDAPRODUCTCODE NORMALIZATION (step 2: first token, strip whitespace)
            if (idx.fda !== -1) {
                const fdaKey = header[idx.fda];
                rows.forEach((r) => {
                    const raw = r[fdaKey];
                    if (raw == null) return;

                    // split on commas, first non-empty
                    const firstToken =
                        String(raw)
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)[0] || "";

                    // remove any whitespace inside that token
                    const normalized = firstToken.replace(/\s+/g, "");

                    if (normalized !== String(raw)) {
                        writeRowText(ws, idx.fda, r, normalized);
                        r[fdaKey] = normalized;
                    }
                });
            }

            // Boohoo transforms
            if (mode === MODES.BOOHOO_PURE || mode === MODES.BOOHOO_HYBRID) {
                const resp = await fetch(`${API}/boohoo/transform`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mode,
                        airline3d: airlineInput || "",
                        rows,
                    }),
                });
                if (!resp.ok) throw new Error(await resp.text());
                const { ok, patches, error } = await resp.json();
                if (!ok) throw new Error(error || "Boohoo transform failed");

                // apply backend patches
                for (const p of patches) {
                    console.log(
                        "Applying patch:",
                        p.col,
                        "at row",
                        p.row,
                        "value:",
                        p.value,
                    );
                    const colIdx = header.findIndex(
                        (h) =>
                            h.trim().toLowerCase() ===
                            String(p.col).trim().toLowerCase(),
                    );
                    console.log("Found column index:", colIdx);
                    if (colIdx !== -1) {
                        const val = p.value == null ? "" : String(p.value);
                        writeRowText(ws, colIdx, rows[p.row], val);
                        rows[p.row][header[colIdx]] = val;
                    }
                }

                // HTS remap for single "HTS" col
                if (idx.hts !== -1) {
                    const mapResp = await fetch(`${API}/boohoo/hts-map`, {
                        cache: "no-store",
                    });
                    if (mapResp.ok) {
                        const { map: rawMap = {} } = await mapResp.json();
                        const norm = (s) =>
                            String(s ?? "")
                                .replace(/[^0-9A-Za-z]/g, "")
                                .toUpperCase();
                        const normMap = new Map(
                            Object.entries(rawMap).map(([k, v]) => [
                                norm(k),
                                String(v),
                            ]),
                        );
                        const htsKey = header[idx.hts];
                        rows.forEach((r) => {
                            const raw = r[htsKey];
                            const fixed =
                                raw == null
                                    ? undefined
                                    : normMap.get(norm(raw));
                            if (fixed && fixed !== raw) {
                                writeRowText(ws, idx.hts, r, fixed);
                                r[htsKey] = fixed;
                            }
                        });
                    }
                }
            }

            // log changes
            await logChanges(changeRows);

            // compact log for download
            const csvRows = Array.from(counts.entries()).map(([k, count]) => {
                const [pair, manu] = k.split("||");
                const [bad_mid, good_mid] = pair.split("-->");
                return {
                    bad_mid,
                    good_mid,
                    manufacturer_name: manu || "",
                    count,
                };
            });
            const logCsv =
                "bad_mid,good_mid,manufacturer_name,count\n" +
                csvRows
                    .map(
                        (c) =>
                            `${csvEsc(c.bad_mid)},${csvEsc(
                                c.good_mid,
                            )},${csvEsc(c.manufacturer_name)},${c.count}`,
                    )
                    .join("\n");

            // clean + export
            fmtDateCols(
                ws,
                idx.entryDate,
                idx.importDate,
                idx.exportDate,
                idx.arrivalDate,
            );
            trimTrailingEmpty(ws);

            const outBuf = XLSX.write(wb, {
                type: "array",
                bookType: "xlsx",
                compression: true,
                bookSST: true,
            });

            const zip = new JSZip();
            zip.file(`results_${file.name}`, outBuf);
            zip.file(`log_${file.name.replace(/\.xlsx$/i, "")}.csv`, logCsv);
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, `midmap_${file.name.replace(/\.xlsx$/i, "")}.zip`);

            setStatus({
                type: "success",
                text: `Done. ${csvRows.length} unique MID change(s). ZIP downloaded.`,
            });
            setChangesJson(JSON.stringify(csvRows, null, 2));
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
                                    {branches.map((b) => {
                                        const label =
                                            b.label ||
                                            `${b.station}${
                                                b.port_code
                                                    ? ` | ${b.port_code}`
                                                    : ""
                                            }`;
                                        return (
                                            <option
                                                key={b.station}
                                                value={b.station}
                                            >
                                                {label}
                                            </option>
                                        );
                                    })}
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

                            {mode === MODES.SHEIN && (
                                <div className="col-md-6">
                                    <label className="form-label">
                                        House AWB (required)
                                    </label>
                                    <input
                                        className="form-control"
                                        placeholder="e.g. 36749974"
                                        value={houseAwb}
                                        onChange={(e) =>
                                            setHouseAwb(e.target.value)
                                        }
                                        required={mode === MODES.SHEIN}
                                    />
                                    <div className="form-text">
                                        We'll fill this automatically from the
                                        file if possible. You can edit it.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="d-flex gap-2 mt-3">
                            <button
                                className="btn btn-primary"
                                disabled={
                                    !file ||
                                    busy ||
                                    !branch ||
                                    !person ||
                                    (mode === MODES.SHEIN && !houseAwb)
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
                                    setHouseAwb("");
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
