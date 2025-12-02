// api/pay-status.js

const _norm = (m) => (m && (m.default || m)) || m;

function ok(res, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(body);
}

function fail(res, code, stage, message, extra = {}) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json({ success: false, stage, message, ...extra });
}

const CONFIG = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
};

// 🚀 FINAL: langsung load CJS PaymentChecker
let PaymentChecker = null;

function loadPaymentChecker() {
  if (PaymentChecker) return PaymentChecker;

  try {
    const c = require('autoft-qris/src/payment-checker.cjs');
    PaymentChecker = _norm(c.PaymentChecker || c);
    return PaymentChecker;
  } catch (e) {
    console.error("PAYMENT CHECKER LOAD FAILED:", e);
    throw new Error("Cannot load PaymentChecker CJS: " + e.message);
  }
}

function normalizeResult(res) {
  if (!res || typeof res !== 'object') {
    return { status: 'UNKNOWN', amount: 0, ref: '', paidAt: null, raw: res };
  }
  let data = res.data ?? res.result ?? res;
  if (Array.isArray(data)) data = data[0] ?? {};
  if (!data || typeof data !== 'object') data = {};

  const statusRaw = data.status || data.payment_status || data.transaction_status;
  const amountRaw = data.amount || data.gross_amount || data.total || data.nominal;

  return {
    status: (statusRaw ? String(statusRaw) : "UNKNOWN").toUpperCase(),
    amount: Number(amountRaw || 0),
    raw: res
  };
}

module.exports = async (req, res) => {
  try {
    let reference, amount;

    if (req.method === "GET") {
      reference = String(req.query.reference || "").trim();
      amount = Number(req.query.amount || 0);
    } else {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      reference = String(body.reference || "").trim();
      amount = Number(body.amount || 0);
    }

    if (!reference) return fail(res, 400, "validate", "reference wajib diisi");
    if (!amount || amount <= 0) return fail(res, 400, "validate", "amount tidak valid");

    if (!CONFIG.auth_username || !CONFIG.auth_token) {
      return fail(res, 500, "config", "ENV API tidak lengkap");
    }

    // Load checker (CJS only)
    let CheckerClass;
    try {
      CheckerClass = loadPaymentChecker();
    } catch (e) {
      return fail(res, 500, "load-payment-checker", e.message);
    }

    const checker = new CheckerClass({
      auth_username: CONFIG.auth_username,
      auth_token: CONFIG.auth_token,
    });

    let raw;
    try {
      raw = await checker.checkPaymentStatus(reference, amount);
    } catch (e) {
      return fail(res, 502, "upstream", "API provider error", { detail: e.message });
    }

    const norm = normalizeResult(raw);

    return ok(res, {
      success: true,
      reference,
      amount,
      status: norm.status,
      raw: norm.raw
    });

  } catch (err) {
    console.error("[pay-status] fatal:", err);
    return fail(res, 500, "fatal", err.message);
  }
};
