const axios = require("axios");

const VPS_BASE = "http://82.27.2.229:5021"; // IP VPS lu (82...)

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function cleanBase(u) {
  return String(u || "").replace(/\/+$/, "");
}

async function proxyJson({ method, url, data }) {
  const r = await axios({
    method,
    url,
    data,
    timeout: 15000,
    validateStatus: () => true,
    headers: { "Content-Type": "application/json" },
  });

  return {
    status: r.status,
    data: r.data,
  };
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const base = cleanBase(VPS_BASE);
  const action = String(req.query?.action || req.body?.action || "").toLowerCase();

  // health
  if (!action) {
    return res.status(200).json({
      ok: true,
      service: "levpay-vercel-proxy",
      vps: base,
      hint: "pakai ?action=createqr|status|cancel",
    });
  }

  try {
    // CREATE QR (proxy ke VPS)
    if (action === "createqr") {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method Not Allowed" });
      }

      const amount = Number(req.body?.amount);
      const theme = req.body?.theme === "theme2" ? "theme2" : "theme1";

      if (!Number.isFinite(amount) || amount < 1) {
        return res.status(400).json({ success: false, error: "amount invalid" });
      }

      const out = await proxyJson({
        method: "POST",
        url: `${base}/api/createqr`,
        data: { amount, theme },
      });

      return res.status(out.status).json(out.data);
    }

    // STATUS (proxy ke VPS)
    if (action === "status") {
      if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method Not Allowed" });
      }

      const idTransaksi = String(req.query?.idTransaksi || "").trim();
      if (!idTransaksi) {
        return res.status(400).json({ success: false, error: "idTransaksi required" });
      }

      const out = await proxyJson({
        method: "GET",
        url: `${base}/api/status?idTransaksi=${encodeURIComponent(idTransaksi)}`,
      });

      return res.status(out.status).json(out.data);
    }

    // CANCEL (proxy ke VPS)
    if (action === "cancel") {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method Not Allowed" });
      }

      const idTransaksi = String(req.body?.idTransaksi || "").trim();
      if (!idTransaksi) {
        return res.status(400).json({ success: false, error: "idTransaksi required" });
      }

      const out = await proxyJson({
        method: "POST",
        url: `${base}/api/cancel`,
        data: { idTransaksi },
      });

      return res.status(out.status).json(out.data);
    }

    return res.status(400).json({
      success: false,
      error: "Unknown action",
      allowed: ["createqr", "status", "cancel"],
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message,
      note: "Kalau ini kena, biasanya VPS gak kebuka port 5021 / firewall / app VPS mati",
    });
  }
};
