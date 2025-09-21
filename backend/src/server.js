require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

const BODY_LIMIT = process.env.BODY_LIMIT || "8mb";

app.use(cors());
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.set("pg", pool);

// ---- health
app.get("/healthz", (_req, res) => res.send("ok"));

app.use("/api/resolve", require("./routes/resolve"));
app.use("/api/log", require("./routes/log"));
app.use("/api/mids", require("./routes/mids"));
app.use("/api/reports", require("./routes/reports"));

// ---- friendly error for oversized payloads
app.use((err, _req, res, next) => {
    if (err && (err.type === "entity.too.large" || err.status === 413)) {
        return res.status(413).json({ ok: false, error: "Payload too large" });
    }
    return next(err);
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`🚀 backend listening on :${port}`));
