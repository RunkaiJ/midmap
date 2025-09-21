const express = require("express");
const router = express.Router();

const clean = (s) => (s ?? "").toString().trim();
const up = (s) => clean(s).toUpperCase();

/** ensure canonical row exists and return id */
async function upsertCanonical(db, good_mid, manufacturer_name) {
    const q = await db.query(
        `insert into midmap.canonical_manufacturers (good_mid, manufacturer_name)
     values ($1,$2)
     on conflict (good_mid) do update set
       manufacturer_name = coalesce(excluded.manufacturer_name, midmap.canonical_manufacturers.manufacturer_name)
     returning id`,
        [up(good_mid), clean(manufacturer_name) || null]
    );
    return q.rows[0].id;
}

async function logGlobal(
    client,
    {
        action, // 'global_alias' | 'global_name'
        actorBranch, // e.g. 'LAX'
        changedBy, // e.g. 'Jane Doe'
        badMid = null,
        manufacturerName = null,
        goodMid,
    }
) {
    await client.query(
        `
    INSERT INTO midmap.change_log (
      changed_at, action, changed_by, actor_branch,
      airline_3d, master_bill_no, importer_id, arrival_airport, arrival_date,
      manufacturer_name, bad_mid, good_mid, client_name
    )
    VALUES (now(), $1, $2, $3,
            NULL, NULL, NULL, NULL, NULL,
            $4, $5, $6, NULL)
  `,
        [
            action,
            changedBy || null,
            actorBranch || null,
            clean(manufacturerName) || null,
            up(badMid) || null,
            up(goodMid),
        ]
    );
}

/** POST /api/mids/triplets/bulk  { created_by, rows:[{bad_mid,manufacturer_name,good_mid}] } */
router.post("/triplets/bulk", express.json(), async (req, res) => {
    const db = req.app.get("pg");
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const who = clean(req.body.changed_by || req.body.created_by) || null;
    const br = clean(req.body.actor_branch || req.body.branch) || null;

    if (!rows.length)
        return res.status(400).json({ ok: false, error: "rows[] required" });

    const client = await db.connect();
    let inserted = 0;
    try {
        await client.query("BEGIN");
        for (const r of rows) {
            const bad = up(r.bad_mid);
            const good = up(r.good_mid);
            const name = clean(r.manufacturer_name);
            if (!bad || !good || !name) continue;

            const cid = await upsertCanonical(client, good, name);

            await client.query(
                `
        INSERT INTO midmap.mid_aliases (bad_mid, good_manufacturer_id, created_by)
        VALUES ($1,$2,$3)
        ON CONFLICT (bad_mid) DO UPDATE
          SET good_manufacturer_id = EXCLUDED.good_manufacturer_id
      `,
                [bad, cid, who]
            );

            await client.query(
                `
        INSERT INTO midmap.name_mappings (manufacturer_name, good_manufacturer_id, created_by)
        VALUES ($1,$2,$3)
        ON CONFLICT (manufacturer_name) DO UPDATE
          SET good_manufacturer_id = EXCLUDED.good_manufacturer_id
      `,
                [name, cid, who]
            );

            // log both sides of the triplet as global actions
            await logGlobal(client, {
                action: "global_alias",
                actorBranch: br,
                changedBy: who,
                badMid: bad,
                goodMid: good,
            });
            await logGlobal(client, {
                action: "global_name",
                actorBranch: br,
                changedBy: who,
                manufacturerName: name,
                goodMid: good,
            });

            inserted++;
        }
        await client.query("COMMIT");
        res.json({ ok: true, inserted });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error(e);
        res.status(500).json({ ok: false, error: e.message });
    } finally {
        client.release();
    }
});

/** POST /api/mids/aliases/bulk  { created_by, rows:[{bad_mid,good_mid}] } */
router.post("/aliases/bulk", express.json(), async (req, res) => {
    const db = req.app.get("pg");
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const who = clean(req.body.changed_by || req.body.created_by) || null;
    const br = clean(req.body.actor_branch || req.body.branch) || null;

    if (!rows.length)
        return res.status(400).json({ ok: false, error: "rows[] required" });

    const client = await db.connect();
    let inserted = 0;
    try {
        await client.query("BEGIN");
        for (const r of rows) {
            const bad = up(r.bad_mid);
            const good = up(r.good_mid);
            if (!bad || !good) continue;

            const cid = await upsertCanonical(client, good, null);
            await client.query(
                `
        INSERT INTO midmap.mid_aliases (bad_mid, good_manufacturer_id, created_by)
        VALUES ($1,$2,$3)
        ON CONFLICT (bad_mid) DO UPDATE
          SET good_manufacturer_id = EXCLUDED.good_manufacturer_id
      `,
                [bad, cid, who]
            );

            await logGlobal(client, {
                action: "global_alias",
                actorBranch: br,
                changedBy: who,
                badMid: bad,
                goodMid: good,
            });

            inserted++;
        }
        await client.query("COMMIT");
        res.json({ ok: true, inserted });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error(e);
        res.status(500).json({ ok: false, error: e.message });
    } finally {
        client.release();
    }
});

/** POST /api/mids/names/bulk  { created_by, rows:[{manufacturer_name,good_mid}] } */
router.post("/names/bulk", express.json(), async (req, res) => {
    const db = req.app.get("pg");
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const who = clean(req.body.changed_by || req.body.created_by) || null;
    const br = clean(req.body.actor_branch || req.body.branch) || null;

    if (!rows.length)
        return res.status(400).json({ ok: false, error: "rows[] required" });

    const client = await db.connect();
    let inserted = 0;
    try {
        await client.query("BEGIN");
        for (const r of rows) {
            const name = clean(r.manufacturer_name);
            const good = up(r.good_mid);
            if (!name || !good) continue;

            const cid = await upsertCanonical(client, good, name);
            await client.query(
                `
        INSERT INTO midmap.name_mappings (manufacturer_name, good_manufacturer_id, created_by)
        VALUES ($1,$2,$3)
        ON CONFLICT (manufacturer_name) DO UPDATE
          SET good_manufacturer_id = EXCLUDED.good_manufacturer_id
      `,
                [name, cid, who]
            );

            await logGlobal(client, {
                action: "global_name",
                actorBranch: br,
                changedBy: who,
                manufacturerName: name,
                goodMid: good,
            });

            inserted++;
        }
        await client.query("COMMIT");
        res.json({ ok: true, inserted });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error(e);
        res.status(500).json({ ok: false, error: e.message });
    } finally {
        client.release();
    }
});

module.exports = router;
