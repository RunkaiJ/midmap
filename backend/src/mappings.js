const withTransaction = require("./transaction");
const clean = (s) => String(s ?? "").trim();

function normalize(rows, key) {
    const byKey = new Map();
    for (const row of rows) {
        const value = key === "bad_mid" ? clean(row[key]).toUpperCase() : clean(row[key]);
        const good_mid = clean(row.good_mid).toUpperCase();
        if (!value || !good_mid) continue;
        if (key === "manufacturer_name" && value.toUpperCase() === good_mid) {
            throw Object.assign(new Error("Manufacturer name must not be a MID."), { status: 400 });
        }
        const existing = byKey.get(value);
        if (existing && existing.good_mid !== good_mid) {
            throw conflict(key, value, existing.good_mid, good_mid);
        }
        byKey.set(value, { [key]: value, good_mid });
    }
    return [...byKey.values()].sort((a, b) => a[key].localeCompare(b[key]));
}

function conflict(key, value, existing, requested) {
    return Object.assign(new Error(`Conflicting mapping for ${key}: ${value}`), {
        status: 409,
        conflicts: [{ field: key, value, existing_good_mid: existing, requested_good_mid: requested }],
    });
}

// Table/column identifiers are internal constants, never request values.
async function insertMappings(db, rows, key, table, person) {
    if (!rows.length) return [];
    const payload = JSON.stringify(rows);
    const inserted = await db.query(`
        INSERT INTO midmap.${table} (${key}, good_manufacturer_id, created_by, created_at)
        SELECT x.${key}, c.id, $2, clock_timestamp()
        FROM jsonb_to_recordset($1::jsonb) AS x(${key} text, good_mid text)
        JOIN midmap.canonical_manufacturers c ON c.good_mid = x.good_mid
        ORDER BY x.${key}
        ON CONFLICT (${key}) DO NOTHING
        RETURNING ${key}
    `, [payload, person]);

    // A concurrent insert may win ON CONFLICT. Verify its actual target before
    // committing; a disagreement rolls back this entire batch, including logs.
    const conflicts = await db.query(`
        SELECT x.${key} AS value, c.good_mid AS existing, x.good_mid AS requested
        FROM jsonb_to_recordset($1::jsonb) AS x(${key} text, good_mid text)
        JOIN midmap.${table} m ON m.${key} = x.${key}
        JOIN midmap.canonical_manufacturers c ON c.id = m.good_manufacturer_id
        WHERE c.good_mid <> x.good_mid
    `, [payload]);
    if (conflicts.rows.length) {
        const row = conflicts.rows[0];
        throw conflict(key, row.value, row.existing, row.requested);
    }
    const keys = new Set(inserted.rows.map((r) => r[key]));
    return rows.filter((r) => keys.has(r[key]));
}

async function logMappings(db, rows, action, branch, person) {
    if (!rows.length) return;
    await db.query(`
        INSERT INTO midmap.change_log
            (action, changed_by, actor_branch, bad_mid, manufacturer_name, good_mid)
        SELECT $2::midmap.change_action, $3, $4, x.bad_mid, x.manufacturer_name, x.good_mid
        FROM jsonb_to_recordset($1::jsonb)
            AS x(bad_mid text, manufacturer_name text, good_mid text)
        ON CONFLICT DO NOTHING
    `, [JSON.stringify(rows), action, person, branch]);
}

async function saveMappings(pool, { rows, mode, branch, person }) {
    const aliases = mode === "name" ? [] : normalize(rows, "bad_mid");
    const names = mode === "alias" ? [] : normalize(rows, "manufacturer_name");
    return withTransaction(pool, async (db) => {
        const mids = [...new Set([...aliases, ...names].map((r) => r.good_mid))].sort();
        if (mids.length) {
            await db.query(`
                INSERT INTO midmap.canonical_manufacturers (good_mid)
                SELECT mid FROM unnest($1::text[]) AS incoming(mid) ORDER BY mid
                ON CONFLICT (good_mid) DO NOTHING
            `, [mids]);
        }
        const addedAliases = await insertMappings(db, aliases, "bad_mid", "mid_aliases", person);
        const addedNames = await insertMappings(db, names, "manufacturer_name", "name_mappings", person);
        if (addedNames.length) {
            await db.query(`
                WITH preferred AS (
                    SELECT DISTINCT ON (good_mid) good_mid, manufacturer_name
                    FROM jsonb_to_recordset($1::jsonb) AS x(good_mid text, manufacturer_name text)
                    ORDER BY good_mid, length(manufacturer_name) DESC, manufacturer_name
                )
                UPDATE midmap.canonical_manufacturers c
                SET manufacturer_name = p.manufacturer_name
                FROM preferred p WHERE c.good_mid = p.good_mid
            `, [JSON.stringify(addedNames)]);
        }
        await logMappings(db, addedAliases, "global_alias", branch, person);
        await logMappings(db, addedNames, "global_name", branch, person);
        const inserted = addedAliases.length + addedNames.length;
        return {
            ok: true, inserted, skipped: aliases.length + names.length - inserted,
            inserted_alias: addedAliases.length, inserted_name: addedNames.length,
        };
    });
}

module.exports = { saveMappings };
