// api/orkut.js (Vercel)
const axios = require("axios");
const { updateDb, getDb } = require("../lib/github");
const { applyVoucher, adminUpsertPromo } = require("../lib/voucher");

const VPS_BASE = process.env.VPS_BASE || "http://82.27.2.229:5021";

// optional: ngunci callback/setstatus
const CALLBACK_SECRET = process.env.CALLBACK_SECRET || "";

// admin untuk set promo
const ADMIN_KEY = process.env.ADMIN_KEY || "";

// ===== CORS =====
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Callback-Secret, X-Admin-Key");
}

async function readAny(res) { return res?.data; }

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

function requireAdmin(req, res) {
  if (!ADMIN_KEY) {
    res.status(500).json({ success: false, error: "ADMIN_KEY not set" });
    return false;
  }
  const got =
    (req.headers["x-admin-key"] || "").toString().trim() ||
    (req.headers.authorization || "").toString().replace(/^Bearer\s+/i, "").trim();
  if (got !== ADMIN_KEY) {
    res.status(401).json({ success: false, error: "Unauthorized (admin)" });
    return false;
  }
  return true;
}

function pickDevice(req) {
  // deviceId dari frontend, fallback ip
  const deviceId = String(req.body?.deviceId || req.query?.deviceId || "").trim();
  if (deviceId) return deviceId;

  const xf = (req.headers["x-forwarded-for"] || "").toString();
  return xf.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
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
        "GET  /api/orkut?action=promos",
        "POST /api/orkut?action=admin_promo_upsert (admin)",
      ],
    });
  }

  // ===== LIST PROMOS (public, tanpa secret) =====
  if (action === "promos") {
    try {
      const { db } = await getDb();
      const promos = Object.values(db.promos || {}).map(p => ({
        code: p.code,
        percent: p.percent,
        expiresAt: p.expiresAt || null,
        enabled: p.enabled !== false,
        maxUses: p.maxUses || 0,
        usedCount: p.usedCount || 0,
      }));
      return res.status(200).json({ success: true, data: promos });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ===== ADMIN UPSERT PROMO =====
  if (action === "admin_promo_upsert") {
    if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });
    if (!requireAdmin(req, res)) return;

    try {
      const out = await updateDb(async (db) => {
        db.promos = db.promos || {};
        const promo = adminUpsertPromo(db, req.body || {});
        return db;
      }, "admin upsert promo");

      return res.status(200).json({ success: true, data: out.db.promos[String(req.body?.code || "").trim().toUpperCase()] });
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  // ===== CREATE QR =====
  if (action === "createqr") {
    if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });

    try {
      const amount = Number(req.body?.amount);
      const theme = (req.body?.theme === "theme1") ? "theme1" : "theme2";
      const promoCode = String(req.body?.promoCode || req.body?.promo || "").trim();

      if (!Number.isFinite(amount) || amount < 1) {
        return res.status(400).json({ success: false, error: "amount invalid" });
      }

      const device = pickDevice(req);

      // apply voucher + persist redemption into GitHub db
      let voucherInfo = null;

      const dbResult = await updateDb(async (db) => {
        const v = applyVoucher(db, device, amount, promoCode);
        voucherInfo = v;
        return db;
      }, "apply voucher");

      const applied = voucherInfo?.applied || null;
      const payAmount = applied?.payAmount || amount;

      // proxy ke VPS (amount yang dibayar = payAmount)
      const r = await axios.post(
        `${VPS_BASE}/api/createqr`,
        { amount: payAmount, theme },
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

      const idTransaksi = data?.data?.idTransaksi || data?.idTransaksi;
      const vpsQrPngUrl =
        data?.data?.qrPngUrl || data?.qrPngUrl || (idTransaksi ? `/api/qr/${idTransaksi}.png` : null);

      const vercelQrUrl = idTransaksi
        ? `${baseUrl}/api/orkut?action=qr&idTransaksi=${encodeURIComponent(idTransaksi)}`
        : null;

      // simpan trx ke GitHub db
      await updateDb(async (db) => {
        db.transactions = db.transactions || {};
        db.transactions[idTransaksi] = {
          idTransaksi,
          createdAt: new Date().toISOString(),
          deviceKey: (voucherInfo?.deviceKey || null),
          amountOriginal: amount,
          amountPay: payAmount,
          discount: applied ? { ...applied } : null,
          theme,
          status: "pending",
          vps: VPS_BASE,
        };
        return db;
      }, `create trx ${idTransaksi}`);

      return res.status(200).json({
        ...data,
        data: {
          ...(data?.data || {}),
          idTransaksi,
          amountOriginal: amount,
          amountPay: payAmount,
          discount: applied ? { ...applied } : null,

          // URL PNG via Vercel (HTTPS)
          qrUrl: vercelQrUrl,

          // URL PNG asli via VPS (HTTP)
          qrVpsUrl: idTransaksi && vpsQrPngUrl ? `${VPS_BASE}${vpsQrPngUrl}` : null,
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
    if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method Not Allowed" });

    const idTransaksi = String(req.query?.idTransaksi || "").trim();
    if (!idTransaksi) return res.status(400).json({ success: false, error: "idTransaksi required" });

    try {
      const r = await axios.get(
        `${VPS_BASE}/api/status?idTransaksi=${encodeURIComponent(idTransaksi)}`,
        { timeout: 15000, validateStatus: () => true }
      );

      const data = await readAny(r);

      // update github kalau terminal/ada status
      const st = String(data?.data?.status || data?.status || "").toLowerCase();
      if (st) {
        const terminal = ["paid", "expired", "cancelled", "failed"].includes(st);
        if (terminal) {
          await updateDb(async (db) => {
            db.transactions = db.transactions || {};
            if (db.transactions[idTransaksi]) {
              db.transactions[idTransaksi].status = st;
              db.transactions[idTransaksi].paidAt = data?.data?.paidAt || null;
              db.transactions[idTransaksi].paidVia = data?.data?.paidVia || null;
              db.transactions[idTransaksi].lastUpdateAt = new Date().toISOString();
            }
            return db;
          }, `terminal status ${idTransaksi}`);
        }
      }

      return res.status(r.status).json(data);
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({ success: false, error: er.message, provider: er.data });
    }
  }

  // ===== CANCEL (POST) =====
  if (action === "cancel") {
    if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });

    const idTransaksi = String(req.body?.idTransaksi || req.query?.idTransaksi || "").trim();
    if (!idTransaksi) return res.status(400).json({ success: false, error: "idTransaksi required" });

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

      await updateDb(async (db) => {
        db.transactions = db.transactions || {};
        if (db.transactions[idTransaksi]) {
          db.transactions[idTransaksi].status = "cancelled";
          db.transactions[idTransaksi].lastUpdateAt = new Date().toISOString();
        }
        return db;
      }, `cancel ${idTransaksi}`);

      return res.status(r.status).json(data);
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({ success: false, error: er.message, provider: er.data });
    }
  }

  // ===== QR PNG STREAM (GET) =====
  if (action === "qr") {
    if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method Not Allowed" });

    const idTransaksi = String(req.query?.idTransaksi || "").trim();
    if (!idTransaksi) return res.status(400).json({ success: false, error: "idTransaksi required" });

    try {
      const r = await axios({
        method: "GET",
        url: `${VPS_BASE}/api/qr/${encodeURIComponent(idTransaksi)}.png`,
        responseType: "stream",
        timeout: 20000,
        validateStatus: () => true,
      });

      if (r.status !== 200) return res.status(r.status).json({ success: false, error: "QR not found on VPS" });

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return r.data.pipe(res);
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({ success: false, error: er.message, provider: er.data });
    }
  }

  // ===== SET STATUS (POST) =====
  if (action === "setstatus") {
    if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });
    if (!requireSecret(req, res)) return;

    const { idTransaksi, status, paidAt, note, paidVia } = req.body || {};
    if (!idTransaksi || !status) {
      return res.status(400).json({ success: false, error: "idTransaksi & status required" });
    }

    try {
      const r = await axios.post(
        `${VPS_BASE}/api/status`,
        { idTransaksi, status, paidAt, note, paidVia },
        {
          timeout: 15000,
          validateStatus: () => true,
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await readAny(r);

      // mirror ke github db
      await updateDb(async (db) => {
        db.transactions = db.transactions || {};
        db.transactions[idTransaksi] = db.transactions[idTransaksi] || { idTransaksi };
        db.transactions[idTransaksi].status = String(status).toLowerCase();
        db.transactions[idTransaksi].paidAt = paidAt || data?.data?.paidAt || null;
        db.transactions[idTransaksi].paidVia = paidVia || data?.data?.paidVia || null;
        db.transactions[idTransaksi].note = note || null;
        db.transactions[idTransaksi].lastUpdateAt = new Date().toISOString();
        return db;
      }, `setstatus ${idTransaksi}`);

      return res.status(r.status).json(data);
    } catch (e) {
      const er = errJson(e);
      return res.status(er.status).json({ success: false, error: er.message, provider: er.data });
    }
  }

  return res.status(404).json({
    success: false,
    error: "Unknown action",
    hint: "pakai action=createqr|status|cancel|qr|setstatus|promos|admin_promo_upsert",
  });
};