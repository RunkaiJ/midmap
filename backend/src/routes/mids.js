const express = require("express");
const { saveMappings } = require("../mappings");
const router = express.Router();
const clean = (s) => String(s ?? "").trim();

for (const [path, mode] of [["/triplets/bulk", "triplet"], ["/aliases/bulk", "alias"], ["/names/bulk", "name"]]) {
    router.post(path, async (req, res) => {
        const branch = clean(req.body?.actor_branch);
        const person = clean(req.body?.changed_by);
        const rows = req.body?.rows;
        if (!branch || !person) {
            return res.status(400).json({ ok: false, error: "actor_branch and changed_by required" });
        }
        if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
            return res.status(400).json({ ok: false, error: "rows must be an array of objects" });
        }
        if (rows.some((r) => !clean(r.good_mid) ||
            (mode !== "name" && !clean(r.bad_mid)) ||
            (mode !== "alias" && !clean(r.manufacturer_name)))) {
            return res.status(400).json({ ok: false, error: "Every row must include the required mapping fields" });
        }
        try {
            const result = await saveMappings(req.app.get("pg"), { rows, mode, branch, person });
            return res.json(result);
        } catch (error) {
            if (!error.status) console.error("Mapping save failed:", error);
            return res.status(error.status || 500).json({
                ok: false,
                error: error.status ? error.message : "Failed to save mappings",
                ...(error.conflicts ? { conflicts: error.conflicts } : {}),
            });
        }
    });
}
module.exports = router;
