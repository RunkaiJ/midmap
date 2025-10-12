// routes/boohoo.js
const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const MODES = {
    SHEIN: "shein",
    BOOHOO_PURE: "boohoo_pure",
    BOOHOO_HYBRID: "boohoo_hybrid",
};

// load mapping (sync at boot; tiny file)
const htsMapPath = path.resolve(__dirname, "../..", "data", "boohoo_hts_map.json");
let HTS_MAP = {};
try {
    HTS_MAP = JSON.parse(fs.readFileSync(htsMapPath, "utf8"));
} catch (e) {
    console.warn(
        "boohoo_hts_map.json not found or invalid, continuing with empty map"
    );
    HTS_MAP = {};
}

// small helpers
const clean = (s) => (s ?? "").toString().trim();
const up = (s) => clean(s).toUpperCase();

/** Turn "AA123", "AA-1234", "AA 0123" => { carrier: "AA", flight: "0123" } */
function splitFlight(s) {
    const t = (s ?? "").toString().replace(/[^A-Za-z0-9]/g, "");
    const m = t.match(/^([A-Za-z]+)(\d.*)$/);
    return m ? { carrier: m[1], flight: m[2] } : { carrier: "", flight: t };
}

/** Collect a patch if value changes */
function maybePatch(patches, rowIdx, col, next, current) {
    const a = (current ?? "").toString();
    const b = (next ?? "").toString();
    if (a !== b) patches.push({ row: rowIdx, col, value: next });
}

/** Apply Boohoo PURE rules to one row and push patches */
function applyPure(row, patches) {
    const country = up(row["ManufacturerCountry"]);
    // Postal logic
    if (country === "GB") {
        maybePatch(
            patches,
            row._i,
            "ManufacturerPostalCode",
            "",
            row["ManufacturerPostalCode"]
        );
    } else if (country === "HK") {
        maybePatch(
            patches,
            row._i,
            "ManufacturerPostalCode",
            "999077",
            row["ManufacturerPostalCode"]
        );
    }
    // India HTS defaults
    if (country === "IN") {
        maybePatch(patches, row._i, "HTS-1", "99030226", row["HTS-1"]);
        maybePatch(patches, row._i, "HTS-2", "99030184", row["HTS-2"]);
    }

    // HTS mapping replacements (if present)
    const htsCols = ["HTS-1", "HTS-2", "HTS-3", "HTS-4"].filter(
        (c) => c in row
    );
    for (const c of htsCols) {
        const cur = clean(row[c]);
        if (!cur) continue;
        const mapped = HTS_MAP[cur] || HTS_MAP[cur.replace(/\s+/g, "")];
        if (mapped) maybePatch(patches, row._i, c, mapped, cur);
    }
}

/** Apply Boohoo HYBRID extras to one row */
function applyHybrid(row, patches, airline3d) {
    // 3-digit airline override
    if (airline3d) {
        maybePatch(
            patches,
            row._i,
            "Airline 3 digit code",
            airline3d,
            row["Airline 3 digit code"]
        );
        // Replace "777" in GroupIdentifier with airline code
        const gi = (row["GroupIdentifier"] ?? "").toString();
        if (gi.includes("777")) {
            const next = gi.replace(/777/g, airline3d);
            maybePatch(patches, row._i, "GroupIdentifier", next, gi);
        }
    }

    // Split flight number into carrier + numeric
    const vf = row["Voyage Flight No"];
    if (vf != null) {
        const { carrier, flight } = splitFlight(vf);
        if (carrier)
            maybePatch(
                patches,
                row._i,
                "Carrier Code",
                carrier,
                row["Carrier Code"]
            );
        if (flight)
            maybePatch(
                patches,
                row._i,
                "Voyage Flight No",
                flight,
                row["Voyage Flight No"]
            );
    }
}

/**
 * GET /boohoo/hts-map
 * Serve the HTS mapping (no caching)
 */
router.get("/hts-map", (_req, res) => {
    // Explicitly disable caching
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    res.json({ ok: true, map: HTS_MAP });
});


/**
 * POST /boohoo/transform
 * Body: { mode: "shein"|"boohoo_pure"|"boohoo_hybrid", airline3d?: "235", rows: [ { ...original row... } ] }
 * Returns: { ok: true, patches: [ { row: <index>, col: "<header>", value: "<new value>" } ] }
 *
 * Notes:
 * - We never write to DB; this only calculates changes.
 * - `row` is the 0-based index within your data rows (header is not included).
 * - Each incoming row must include `_i` (its index). If not provided, we derive it.
 */
router.post("/transform", (req, res) => {
    const body = req.body || {};
    const mode = (body.mode || MODES.SHEIN).toLowerCase();
    const airline3d = clean(body.airline3d || "");
    const rows = Array.isArray(body.rows) ? body.rows : [];

    // annotate row index if caller didn't add it
    rows.forEach((r, i) => {
        if (typeof r._i !== "number") r._i = i;
    });

    const patches = [];

    if (mode === MODES.BOOHOO_PURE || mode === MODES.BOOHOO_HYBRID) {
        for (const r of rows) {
            applyPure(r, patches);
            if (mode === MODES.BOOHOO_HYBRID) {
                applyHybrid(r, patches, airline3d);
            }
        }
    }
    // SHEIN mode: nothing extra (MID logic handled elsewhere)

    return res.json({ ok: true, patches });
});

module.exports = router;
