const axios = require("axios");

const VPS_BASE = "http://82.27.2.229:5021";

// optional: kalau mau ngunci callback/setstatus (biar ga sembarang orang nembak)
// isi sama string secret yg lu mau. kalau ga mau, biarin ""
const CALLBACK_SECRET = "";

// ===== CORS =====
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Callback-Secret");
}

async function readAny(res) {
  // axios udah parse json kalau content-type json, tapi kadang provider aneh
  return res?.data;
}

function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function errJson(error) {
  const status = error?.response?.status || 500;
  const data = error?.response?.data || null;
  return { status, data, message: error?.message || "Unknown error" };
}

function requireSecret(req, res) {
  if (!CALLBACK_SECRET) return true;
  const got =
    (req.headers["x-callback-secret"] || "").toString().trim() ||
    (req.headers.authorization || "").toString().replace(/^Bearer\s+/i, "").trim();
  if (got !== CALLBACK_SECRET) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = String(req.query?.action || "").toLowerCase().trim();
  const baseUrl = getBaseUrl(req);

  // default info
  if (!action || action === "ping") {
    return res.status(200).json({
      success: true,
      service: "levpay-vercel-proxy",
      vps: VPS_BASE,
      routes: [
        "POST /api/orkut?action=createqr",
        "GET  /api/orkut?action=status&idTransaksi=...",
        "POST /api/orkut?action=cancel",
        "GET  /api/orkut?action=qr&idTransaksi=...",
        "POST /api/orkut?action=setstatus",
      ],
    });
  }

  // ===== CREATE QR =====
  if (action === "createqr") {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    try {
      const amount = Number(req.body?.amount);
      const theme = (req.body?.theme === "theme2") ? "theme2" : "theme1";

      if (!Number.isFinite(amount) || amount < 1) {
        return res.status(400).json({ success: false, error: "amount invalid" });
      }

      // proxy ke VPS
      const r = await axios.post(
        `${VPS_BASE}/api/createqr`,
        { amount, theme },
        {
          timeout: 20000,
          validateStatus: () => true,
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await readAny(r);

      if (r.status !== 200) {
        return res.status(r.status).json({
          success: false,
          error: "VPS createqr failed",
          provider: data,
        });
      }

      // pastiin ada idTransaksi
      const idTransaksi = data?.data?.idTransaksi || data?.idTransaksi;
      const vpsQrPngUrl = data?.data?.qrPngUrl || data?.qrPngUrl || (idTransaksi ? `/api/qr/${idTransaksi}.png` : null);

      // bikin link QR versi HTTPS Vercel (proxy)
      const vercelQrUrl = idTransaksi
        ? `${baseUrl}/api/orkut?action=qr&idTransaksi=${encodeURIComponent(idTransaksi)}`
        : null;

      return res.status(200).json({
        ...data,
        data: {
          ...(data?.data || {}),
          idTransaksi,
          // URL PNG via Vercel (HTTPS)
          qrUrl: vercelQrUrl,
          // URL PNG asli via VPS (HTTP)
          qrVpsUrl: idTransaksi ? `${VPS_BASE}${vpsQrPngUrl}` : null,
        },
      });
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({
        success: false,
        error: er.message,
        provider: er.data,
      });
    }
  }

  // ===== STATUS (GET) =====
  if (action === "status") {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    const idTransaksi = String(req.query?.idTransaksi || "").trim();
    if (!idTransaksi) {
      return res.status(400).json({ success: false, error: "idTransaksi required" });
    }

    try {
      const r = await axios.get(
        `${VPS_BASE}/api/status?idTransaksi=${encodeURIComponent(idTransaksi)}`,
        { timeout: 15000, validateStatus: () => true }
      );

      const data = await readAny(r);
      return res.status(r.status).json(data);
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({
        success: false,
        error: er.message,
        provider: er.data,
      });
    }
  }

  // ===== CANCEL (POST) =====
  if (action === "cancel") {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    const idTransaksi = String(req.body?.idTransaksi || req.query?.idTransaksi || "").trim();
    if (!idTransaksi) {
      return res.status(400).json({ success: false, error: "idTransaksi required" });
    }

    try {
      const r = await axios.post(
        `${VPS_BASE}/api/cancel`,
        { idTransaksi },
        {
          timeout: 15000,
          validateStatus: () => true,
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await readAny(r);
      return res.status(r.status).json(data);
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({
        success: false,
        error: er.message,
        provider: er.data,
      });
    }
  }

  // ===== QR PNG STREAM (GET) =====
  if (action === "qr") {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    const idTransaksi = String(req.query?.idTransaksi || "").trim();
    if (!idTransaksi) {
      return res.status(400).json({ success: false, error: "idTransaksi required" });
    }

    try {
      const r = await axios({
        method: "GET",
        url: `${VPS_BASE}/api/qr/${encodeURIComponent(idTransaksi)}.png`,
        responseType: "stream",
        timeout: 20000,
        validateStatus: () => true,
      });

      if (r.status !== 200) {
        return res.status(r.status).json({ success: false, error: "QR not found on VPS" });
      }

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return r.data.pipe(res);
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({
        success: false,
        error: er.message,
        provider: er.data,
      });
    }
  }

  // ===== SET STATUS (POST) =====
  // buat callback / manual update ke VPS /api/status
  if (action === "setstatus") {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    // kalau mau dikunci
    if (!requireSecret(req, res)) return;

    const { idTransaksi, status, paidAt, note } = req.body || {};
    if (!idTransaksi || !status) {
      return res.status(400).json({ success: false, error: "idTransaksi & status required" });
    }

    try {
      const r = await axios.post(
        `${VPS_BASE}/api/status`,
        { idTransaksi, status, paidAt, note },
        {
          timeout: 15000,
          validateStatus: () => true,
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await readAny(r);
      return res.status(r.status).json(data);
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({
        success: false,
        error: er.message,
        provider: er.data,
      });
    }
  }

  // ===== UNKNOWN =====
  return res.status(404).json({
    success: false,
    error: "Unknown action",
    hint: "pakai action=createqr|status|cancel|qr|setstatus",
  });
};
