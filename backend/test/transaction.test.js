const test = require("node:test");
const assert = require("node:assert/strict");
const withTransaction = require("../src/transaction");

test("parallel transactions keep separate checked-out connections until commit", async () => {
    const connections = [];
    const pool = {
        query() { throw new Error("Transactions must not use pool.query"); },
        async connect() {
            const calls = [];
            const client = {
                calls,
                async query(sql) { calls.push(sql); },
                release(error) { calls.push(error || "release"); },
            };
            connections.push(client);
            return client;
        },
    };
    const results = await Promise.all(["first", "second"].map((value) =>
        withTransaction(pool, async (db) => { await db.query(value); return value; })));
    assert.deepEqual(results, ["first", "second"]);
    assert.deepEqual(connections.map((c) => c.calls), [
        ["BEGIN", "first", "COMMIT", "release"],
        ["BEGIN", "second", "COMMIT", "release"],
    ]);
});

test("failed work rolls back and releases, even when rollback itself fails", async () => {
    for (const rollbackFails of [false, true]) {
        const calls = [];
        const original = new Error("insert failed");
        const broken = new Error("connection lost");
        const pool = { async connect() { return {
            async query(sql) { calls.push(sql); if (sql === "ROLLBACK" && rollbackFails) throw broken; },
            release(error) { calls.push(error || "release"); },
        }; } };
        await assert.rejects(withTransaction(pool, async () => { throw original; }), (e) => e === original);
        assert.deepEqual(calls, ["BEGIN", "ROLLBACK", rollbackFails ? broken : "release"]);
    }
});
