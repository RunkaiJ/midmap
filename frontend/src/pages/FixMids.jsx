import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const API = import.meta.env.VITE_API_BASE;

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
                airline: findIdx([
                    "Airline 3 digit code",
                    "Airline3DigitCode",
                    "airline_3d",
                ]),
                bill: findIdx([
                    "Master Bill Number",
                    "MasterBillNumber",
                    "master_bill_no",
                    "MBL",
                    "MB",
                ]),
                importer: findIdx(["ImporterID", "importer_id"]),
                airport: findIdx([
                    "Arrival Airport",
                    "ArrivalAirport",
                    "arrival_airport",
                ]),
                date: findIdx([
                    "Arrival Date",
                    "ArrivalDate",
                    "ETA",
                    "arrival_date",
                ]),
                name: findIdx([
                    "ManufacturerName",
                    "Manufacturer Name",
                    "SupplierName",
                    "manufacturer_name",
                ]),
                mid: findIdx([
                    "ManufacturerCode",
                    "Manufacturer Code",
                    "MID",
                    "Bad ManufacturerCode",
                ]),
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
                            idx.date === -1
                                ? null
                                : (r[header[idx.date]] ?? "").toString(),
                        manufacturer_name,
                        bad_mid,
                        good_mid: hit.good_mid,
                        method: hit.method, // 'alias' or 'name'
                    });
                }
            });

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
            const outBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
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
                <p className="text-muted">
                    We modify only the <strong>ManufacturerCode</strong> column,
                    prefer <em>alias</em> over <em>name</em>, log changes, and
                    download a ZIP (updated Excel + compact log).
                </p>

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
