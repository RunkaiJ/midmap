import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { cleanDescription, cleanDescriptionColumns, readWorksheet, writeRowText, midPairKey } from "../src/lib/worksheet.js";

test("description removes symbols, collapses whitespace, then takes 75 Unicode characters", () => {
    assert.equal(cleanDescription("  Men's / cotton\t  shirt! 👕\n100%  "), "Mens cotton shirt 100");
    assert.equal(cleanDescription(null), "");
    assert.equal(cleanDescription("!@#$😀"), "");
    assert.equal(cleanDescription("  中文  café  123 "), "中文 café 123");
    assert.equal(cleanDescription("!".repeat(80) + "a".repeat(76)), "a".repeat(75));
    assert.equal(Array.from(cleanDescription("𠮷".repeat(80))).length, 75);
});

test("both exact description columns survive Excel export without altering other descriptions", () => {
    const ws = XLSX.utils.aoa_to_sheet([
        [" DescOfMerchandish ", "DESCRIPTION", "Other Description", "ManufacturerCode"],
        ["  A!   B ", "c".repeat(80), "leave!  alone", "bad1"],
        [],
        ["D@ E", "F\n G", "unchanged!", "bad2"],
    ]);
    const { header, rows } = readWorksheet(ws);
    assert.equal(cleanDescriptionColumns(ws, header, rows), 2);
    const results = new Map([[midPairKey("BAD2", ""), "GOOD2"]]);
    writeRowText(ws, 3, rows[1], results.get(midPairKey(rows[1].ManufacturerCode, "")));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const exported = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" }).Sheets.Data;
    assert.equal(exported.A2.v, "A B");
    assert.equal(exported.B2.v.length, 75);
    assert.equal(exported.C2.v, "leave!  alone");
    assert.equal(exported.A4.v, "D E");
    assert.equal(exported.B4.v, "F G");
    assert.equal(exported.D4.v, "GOOD2");
    assert.equal(exported.D3, undefined);
    assert.equal(exported.A1.v, " DescOfMerchandish ");
});

test("writes use physical coordinates on offset sheets and preserve missing description columns", () => {
    const ws = XLSX.utils.aoa_to_sheet([
        ["ManufacturerCode", "Manufacturer Name"],
        ["bad", "Maker"], [], ["bad2", "Maker2"],
    ], { origin: "C4" });
    const { header, rows } = readWorksheet(ws);
    assert.equal(header.indexOf("ManufacturerCode"), 2);
    assert.equal(rows[1].__rowNum__, 6);
    assert.equal(cleanDescriptionColumns(ws, header, rows), 0);
    writeRowText(ws, 2, rows[1], "GOOD");
    assert.equal(ws.C7.v, "GOOD");
    assert.equal(ws.C6, undefined);
    assert.equal(midPairKey(" bad ", " Maker "), midPairKey("BAD", "Maker"));
    assert.notEqual(midPairKey("A||B", "C"), midPairKey("A", "B||C"));
});
