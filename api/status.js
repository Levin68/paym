// api/status.js
const axios = require("axios");

// VPS lu (HTTP)
const VPS_BASE = "http://82.27.2.229:5021";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  // FE lu GET /api/status?idTransaksi=xxxx
  const idTransaksi =
    (req.query && req.query.idTransaksi) ||
    (req.query && req.query.idtrx) ||
    (req.body && req.body.idTransaksi);

  if (!idTransaksi) {
    return res.status(400).json({ success: false, error: "idTransaksi required" });
  }

  try {
    const r = await axios.get(`${VPS_BASE}/status`, {
      params: { idTransaksi: String(idTransaksi) },
      timeout: 10000,
      validateStatus: () => true,
    });

    // pass-through status + body dari VPS
    return res.status(r.status).json(r.data);
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message || "proxy status failed",
    });
  }
};
