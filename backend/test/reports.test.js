const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

// Exercise the real route handler while injecting cursor/workbook failures.
function loadHandler(commit) {
    const routes = new Map();
    const router = { get(path, handler) { routes.set(path, handler); } };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve("../src/routes/reports"), "utf8"), {
        module,
        console: { error() {} },
        require(name) {
            if (name === "express") return { Router: () => router };
            if (name === "pg-cursor") return class Cursor {};
            if (name === "exceljs") return { stream: { xlsx: { WorkbookWriter: class {
                addWorksheet() { return { getRow: () => ({ commit() {} }), addRow: () => ({ commit() {} }), commit() {} }; }
                commit() { return commit(); }
            } } } };
            throw new Error(name);
        },
    });
    return routes.get("/table.xlsx");
}

for (const failure of ["read", "commit", "none"]) {
    test(`Excel export releases cursor and connection after ${failure} failure`, async () => {
        let closed = 0;
        let released = 0;
        const handler = loadHandler(async () => { if (failure === "commit") throw new Error("ZIP failed"); });
        const db = { async connect() { return {
            query() { return {
                read(_size, callback) { callback(failure === "read" ? new Error("DB failed") : null, []); },
                close(callback) { closed++; callback(); },
            }; },
            release() { released++; },
        }; } };
        const res = new EventEmitter();
        Object.assign(res, {
            set() {}, setHeader() {}, removeHeader() {},
            status(code) { this.statusCode = code; return this; },
            type() { return this; }, send() {}, destroy() { this.destroyed = true; },
        });
        await handler({ query: {}, app: { get: () => db } }, res);
        assert.equal(closed, 1);
        assert.equal(released, 1);
        if (failure !== "none") assert.equal(res.statusCode, 500);
    });
}
