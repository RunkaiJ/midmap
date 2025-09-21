require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
app.set("pg", pool);

app.use("/api/resolve", require("./routes/resolve"));
app.use("/api/log", require("./routes/log"));
app.use("/api/mids", require("./routes/mids"));
app.use("/api/reports", require("./routes/reports"));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`🚀 backend listening on :${port}`));
