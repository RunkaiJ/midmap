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

// Tiny helpers to write text cells
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

    // trim empty rows from bottom
    while (R1 >= R0) {
        let hasData = false;
        for (let c = C0; c <= C1; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r: R1, c })];
            if (
                cell &&
                cell.v != null &&
                (typeof cell.v === "number" || String(cell.v).trim() !== "")
            ) {
                hasData = true;
                break;
            }
        }
        if (hasData) break;
        for (let c = C0; c <= C1; c++)
            delete ws[XLSX.utils.encode_cell({ r: R1, c })];
        R1--;
    }

    // trim empty columns from right
    while (C1 >= C0) {
        let hasData = false;
        for (let r = R0; r <= R1; r++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c: C1 })];
            if (
                cell &&
                cell.v != null &&
                (typeof cell.v === "number" || String(cell.v).trim() !== "")
            ) {
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

// Make chosen columns display as m/d/yyyy (for cells that already hold serials)
function fmtDateCols(ws, ...colIdx) {
    const rng = XLSX.utils.decode_range(ws["!ref"]);
    for (const c of colIdx) {
        for (let r = 1; r <= rng.e.r; r++) {
            // start at row 1 (skip header at r=0)
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            if (cell && typeof cell.v === "number") {
                // serial -> just add a format
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

    // branches
    const [branches, setBranches] = useState([]); // [{station, port_code, label?}]
    const [branch, setBranch] = useState(""); // required
    const [person, setPerson] = useState("");

    const [status, setStatus] = useState(null);
    const [changesJson, setChangesJson] = useState("");
    const [busy, setBusy] = useState(false);

    // NEW: client mode + airline input (hybrid only) + HTS map
    const [mode, setMode] = useState(MODES.SHEIN);
    const [airlineInput, setAirlineInput] = useState(""); // shown only for Hybrid
    const [htsMap, setHtsMap] = useState({}); // {bad:"good", ...}

    // Load HTS map lazily for BOOHOO modes (no-op if 404)
    useEffect(() => {
        let cancelled = false;
        if (mode === MODES.BOOHOO_PURE || mode === MODES.BOOHOO_HYBRID) {
            (async () => {
                try {
                    const r = await fetch(`${API}/boohoo/hts-map`, {
                        cache: "no-store",
                    });
                    if (!r.ok) return; // silently skip until backend ready
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

    // Load branches for the select
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
                // keep UI usable even if meta fails
                console.error("Failed to load /log/meta:", e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const onFile = (e) => {
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
        await fetch(`${API}/log/changes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows, branch, person }),
        }).catch(() => {}); // non-blocking
    }

    const processAndDownload = async (e) => {
        e.preventDefault();
        if (!file)
            return setStatus({ type: "warning", text: "Choose a .xlsx file." });
        if (!branch || !person)
            return setStatus({
                type: "warning",
                text: "Please select a Branch.",
            });

        setBusy(true);
        setStatus({ type: "info", text: "Processing in browser…" });
        setChangesJson("");

        try {
            // 1) read workbook
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];

            // 2) parse headers & rows
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
                // NEW: four date columns
                entryDate: findIdx(["EntryDate", "Entry Date"]),
                importDate: findIdx(["ImportDate", "Import Date"]),
                exportDate: findIdx(["Date of Export"]),
                arrivalDate: findIdx(["Arrival Date", "ArrivalDate"]),

                name: findIdx(["ManufacturerName", "Manufacturer Name"]),
                mid: findIdx(["ManufacturerCode", "Manufacturer Code"]),
                house: findIdx(["House AWB"]),
                fda: findIdx(["FDAPRODUCTCODE"]),

                // NEW: BOOHOO-specific columns
                manuCountry: findIdx([
                    "ManufacturerCountry",
                    "Manufacturer Country",
                ]),
                manuPostal: findIdx([
                    "ManufacturerPostalCode",
                    "Manufacturer Postal Code",
                ]),
                hts1: findIdx(["HTS-1", "HTS 1"]),
                hts2: findIdx(["HTS-2", "HTS 2"]),
                groupId: findIdx(["GroupIdentifier", "Group Identifier"]),
                flightNo: findIdx(["Voyage Flight No", "VoyageFlightNo"]),
                carrierCode: findIdx(["Carrier Code", "CarrierCode"]),
                hts: findIdx(["HTS"]),
            };

            if (idx.mid === -1)
                throw new Error("Could not find ManufacturerCode column.");
            if (idx.airline === -1 || idx.bill === -1)
                throw new Error(
                    "Need Airline 3 digit code and Master Bill Number columns."
                );

            // 3) collect unique (bad_mid, manufacturer_name)
            const uniqKey = (b, n) =>
                `${(b || "").trim()}||${(n || "").trim()}`;
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

            // 4) resolve (alias > name)
            const resolved = await resolvePairs(
                Array.from(uniquePairs.values())
            );
            const resMap = new Map(
                resolved.map((x) => [
                    uniqKey(x.bad_mid, x.manufacturer_name),
                    x,
                ])
            );

            // 5) apply replacements + collect logs
            const colLetter = XLSX.utils.encode_col(idx.mid);
            const counts = new Map(); // unique code changes (for compact log)
            const changeRows = []; // per-row changes for DB logging

            rows.forEach((r, i) => {
                const bad_mid = (r[header[idx.mid]] ?? "").toString().trim();
                const manufacturer_name =
                    idx.name === -1
                        ? ""
                        : (r[header[idx.name]] ?? "").toString().trim();
                const hit = resMap.get(uniqKey(bad_mid, manufacturer_name));
                if (hit && hit.good_mid && hit.good_mid !== bad_mid) {
                    // write back into the worksheet cell
                    const excelRow = i + 2; // header is row 1
                    const addr = `${colLetter}${excelRow}`;
                    ws[addr] = { t: "s", v: hit.good_mid };

                    // compact per-file log
                    const k = `${hit.bad_mid}-->${hit.good_mid}||${manufacturer_name}`;
                    counts.set(k, (counts.get(k) || 0) + 1);

                    // per-row change (for DB)
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
                        method: hit.method, // 'alias' or 'name'
                    });
                }
            });

            // (A) If House AWB is blank, copy Master Bill Number into it
            if (idx.house !== -1 && idx.bill !== -1) {
                const houseCol = idx.house;
                rows.forEach((r, i) => {
                    const house = (r[header[houseCol]] ?? "").toString().trim();
                    if (!house) {
                        const bill = (r[header[idx.bill]] ?? "")
                            .toString()
                            .trim();
                        if (bill) {
                            // write as text to preserve leading zeros if any
                            writeTextCell(ws, houseCol, i + 2, bill);
                        }
                    }
                });
            }

            // (B) Normalize FDAPRODUCTCODE: remove ALL whitespace
            if (idx.fda !== -1) {
                const col = idx.fda;
                const key = header[col];

                rows.forEach((r, i) => {
                    const raw = r[key];
                    if (raw == null) return;

                    // remove spaces, tabs, newlines, etc.
                    const normalized = String(raw).replace(/\s+/g, "");

                    if (normalized !== String(raw)) {
                        writeTextCell(ws, col, i + 2, normalized);
                        r[key] = normalized; // optional: keep rows[] in sync
                    }
                });
            }

            /* ---------------- BOOHOO rules ---------------- */
            if (mode === MODES.BOOHOO_PURE || mode === MODES.BOOHOO_HYBRID) {
                const resp = await fetch(`${API}/boohoo/transform`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mode, // "BOOHOO_PURE" | "BOOHOO_HYBRID"
                        airline3d: airlineInput || "", // required for HYBRID, "" for PURE
                        rows, // parsed row objects
                    }),
                });
                if (!resp.ok) throw new Error(await resp.text());
                const { ok, patches, error } = await resp.json();
                if (!ok) throw new Error(error || "Boohoo transform failed");

                // Apply backend patches (case-insensitive column match)
                for (const p of patches) {
                    const colIdx = header.findIndex(
                        (h) =>
                            h.trim().toLowerCase() ===
                            String(p.col).trim().toLowerCase()
                    );
                    if (colIdx !== -1) {
                        const val = p.value == null ? "" : String(p.value);
                        writeTextCell(ws, colIdx, p.row + 2, val);
                        rows[p.row][header[colIdx]] = val; // keep parsed rows in sync
                    }
                }

                // Frontend HTS remap for a single "HTS" column (backend already handles HTS-1/2/3/4)
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

                        // normalize keys once for fast lookup
                        const htsMap = new Map(
                            Object.entries(rawMap).map(([k, v]) => [
                                norm(k),
                                String(v),
                            ])
                        );

                        const key = header[idx.hts];
                        rows.forEach((r, i) => {
                            const raw = r[key];
                            if (raw == null) return;
                            const fixed = htsMap.get(norm(raw));
                            if (fixed && fixed !== raw) {
                                writeTextCell(ws, idx.hts, i + 2, fixed); // Excel row = dataIndex + 2
                                r[key] = fixed; // keep rows[] in sync
                            }
                        });
                    }
                }
            }

            // 6) send per-row changes to backend (includes required branch)
            await logChanges(changeRows);

            // 7) build compact log (unique pairs with counts)
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
                                c.good_mid
                            )},${csvEsc(c.manufacturer_name)},${c.count}`
                    )
                    .join("\n");

            // 8) download ZIP (updated original + compact log)
            fmtDateCols(
                ws,
                idx.entryDate,
                idx.importDate,
                idx.exportDate,
                idx.arrivalDate
            );

            trimTrailingEmpty(ws);

            const outBuf = XLSX.write(wb, {
                type: "array",
                bookType: "xlsx",
                compression: true, // <-- compress inner XLSX
                bookSST: true, // often shrinks files with lots of repeated strings
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
                                />
                            </div>
                        </div>

                        <div className="d-flex gap-2 mt-3">
                            <button
                                className="btn btn-primary"
                                disabled={!file || busy || !branch || !person}
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
