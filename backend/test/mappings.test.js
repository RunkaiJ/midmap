const test = require("node:test");
const assert = require("node:assert/strict");
const { saveMappings } = require("../src/mappings");

function fakePool({ inserted = [], conflicts = [], failAudit = false } = {}) {
    const calls = [];
    return {
        calls,
        async connect() { return {
            async query(sql, params) {
                calls.push({ sql, params });
                if (sql.includes("AS existing")) return { rows: conflicts };
                if (sql.includes("RETURNING bad_mid")) return { rows: inserted.map((bad_mid) => ({ bad_mid })) };
                if (sql.includes("INSERT INTO midmap.change_log") && failAudit) throw new Error("audit unavailable");
                return { rows: [], rowCount: 0 };
            },
            release() { calls.push({ sql: "RELEASE" }); },
        }; },
    };
}
const input = (rows) => ({ rows, mode: "alias", branch: "JFK", person: "Tester" });

test("conflicting targets in one batch are rejected before opening a transaction", async () => {
    const pool = fakePool();
    await assert.rejects(saveMappings(pool, input([
        { bad_mid: "bad", good_mid: "GOOD1" }, { bad_mid: "BAD", good_mid: "GOOD2" },
    ])), { status: 409 });
    assert.equal(pool.calls.length, 0);
});

test("existing or concurrent conflicting mapping rolls back the whole batch", async () => {
    const pool = fakePool({ conflicts: [{ value: "BAD", existing: "OLD", requested: "NEW" }] });
    await assert.rejects(saveMappings(pool, input([{ bad_mid: "BAD", good_mid: "NEW" }])), (e) => {
        assert.equal(e.status, 409);
        assert.equal(e.conflicts[0].existing_good_mid, "OLD");
        return true;
    });
    assert.deepEqual(pool.calls.slice(-2).map((c) => c.sql), ["ROLLBACK", "RELEASE"]);
    assert.equal(pool.calls.some((c) => c.sql.includes("INSERT INTO midmap.change_log")), false);
});

test("inserted count and audit reflect actual mappings, not log insert counts", async () => {
    const pool = fakePool({ inserted: ["NEW"] });
    const result = await saveMappings(pool, input([
        { bad_mid: "new", good_mid: "GOOD" }, { bad_mid: "OLD", good_mid: "GOOD" },
    ]));
    assert.equal(result.inserted, 1);
    assert.equal(result.skipped, 1);
    const log = pool.calls.find((c) => c.sql.includes("INSERT INTO midmap.change_log"));
    assert.deepEqual(JSON.parse(log.params[0]), [{ bad_mid: "NEW", good_mid: "GOOD" }]);
    const canonical = pool.calls.find((c) => c.sql.includes("INSERT INTO midmap.canonical"));
    assert.deepEqual(canonical.params[0], ["GOOD"]);
    assert.deepEqual(pool.calls.slice(-2).map((c) => c.sql), ["COMMIT", "RELEASE"]);
});

test("audit failure rolls back newly inserted mappings", async () => {
    const pool = fakePool({ inserted: ["NEW"], failAudit: true });
    await assert.rejects(saveMappings(pool, input([{ bad_mid: "NEW", good_mid: "GOOD" }])), /audit unavailable/);
    assert.deepEqual(pool.calls.slice(-2).map((c) => c.sql), ["ROLLBACK", "RELEASE"]);
});

test("different importers survive log input normalization", async () => {
    const router = require("../src/routes/log");
    const handler = router.stack.find((s) => s.route?.path === "/changes").route.stack[0].handle;
    let payload;
    const db = { async query(sql, params) {
        assert.match(sql, /LEFT JOIN midmap.clients/);
        payload = JSON.parse(params[0]);
        return { rowCount: 2 };
    } };
    const row = { airline_3d: "123", master_bill_no: "BILL", arrival_date: "2026-09-30", bad_mid: "bad", good_mid: "GOOD", method: "auto_alias" };
    let response;
    await handler({ app: { get: () => db }, body: { branch: "JFK", person: "Tester", rows: [
        { ...row, importer_id: "I1" }, { ...row, importer_id: "I2" },
    ] } }, { json(value) { response = value; } });
    assert.deepEqual(payload.map((r) => r.importer_id), ["I1", "I2"]);
    assert.deepEqual(response, { ok: true, inserted: 2, skipped: 0 });
});
