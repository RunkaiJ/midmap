import * as XLSX from "xlsx";

export function cleanDescription(value) {
    const text = String(value ?? "")
        .normalize("NFC")
        .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
        .replace(/\s+/gu, " ")
        .trim();
    return Array.from(text).slice(0, 75).join("");
}

export function midPairKey(mid, name) {
    return JSON.stringify([
        String(mid ?? "").trim().toUpperCase(),
        String(name ?? "").trim(),
    ]);
}

// Keep physical column/row coordinates, including sheets starting outside A1.
// Duplicate headers get distinct object keys; the workbook headers stay intact.
export function readWorksheet(ws) {
    if (!ws?.["!ref"]) throw new Error("The first worksheet is empty.");
    const range = XLSX.utils.decode_range(ws["!ref"]);
    // Some exporters include leading blank rows inside !ref.
    while (range.s.r <= range.e.r) {
        let populated = false;
        for (let c = range.s.c; c <= range.e.c; c++) {
            const value = ws[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v;
            if (value != null && String(value).trim() !== "") populated = true;
        }
        if (populated) break;
        range.s.r++;
    }
    if (range.s.r > range.e.r) throw new Error("The first worksheet is empty.");
    const header = Array(range.e.c + 1).fill("");
    const used = new Set();
    for (let c = range.s.c; c <= range.e.c; c++) {
        const raw = String(ws[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v ?? "").trim();
        const base = raw || "__EMPTY";
        let key = base;
        let suffix = 1;
        while (used.has(key)) key = `${base}_${suffix++}`;
        used.add(key);
        header[c] = key;
    }
    const rows = [];
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
        const row = Object.create(null);
        let hasData = false;
        for (let c = range.s.c; c <= range.e.c; c++) {
            const value = ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
            row[header[c]] = value;
            if (value != null && String(value).trim() !== "") hasData = true;
        }
        if (hasData) {
            Object.defineProperty(row, "__rowNum__", { value: r });
            rows.push(row);
        }
    }
    return { header, rows };
}

export function writeRowText(ws, colIndex, row, text) {
    if (colIndex < 0 || !Number.isInteger(row?.__rowNum__)) {
        throw new Error("Invalid worksheet coordinates.");
    }
    const addr = XLSX.utils.encode_cell({ c: colIndex, r: row.__rowNum__ });
    ws[addr] = { t: "s", v: String(text ?? "") };
}

export function cleanDescriptionColumns(ws, header, rows) {
    const names = new Set(["descofmerchandish", "description"]);
    const columns = header.flatMap((name, c) => names.has(name.trim().toLowerCase()) ? [c] : []);
    for (const row of rows) {
        for (const c of columns) {
            const value = cleanDescription(row[header[c]]);
            writeRowText(ws, c, row, value);
            row[header[c]] = value;
        }
    }
    return columns.length;
}
