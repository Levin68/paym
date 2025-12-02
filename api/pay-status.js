// api/pay-status.js

const _norm = (m) => (m && (m.default || m)) || m;

// ===== 1. ENV CONFIG =====
const CONFIG = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN
};

// ===== 2. LOAD PAYMENTCHECKER (CJS ONLY) =====
let PaymentChecker = null;
let loaderError = null;

try {
  const mod = require('autoft-qris/src/payment-checker.cjs');
  PaymentChecker = _norm(mod.PaymentChecker || mod);
  if (!PaymentChecker) {
    loaderError = new Error('PaymentChecker class tidak ditemukan di CJS');
  }
} catch (e) {
  loaderError = e;
}

// ===== 3. NORMALIZER STATUS =====
function normalizeStatus(raw) {
  if (!raw || typeof raw !== 'object') {
    return 'UNKNOWN';
  }

  let data = raw.data ?? raw.result ?? raw;
  if (Array.isArray(data)) data = data[0] ?? {};
  if (!data || typeof data !== 'object') data = {};

  const statusRaw =
    data.status ||
    data.payment_status ||
    data.transaction_status;

  if (!statusRaw) return 'UNKNOWN';
  return String(statusRaw).toUpperCase();
}

// ===== 4. UNIFIED RESPONSE =====
function respond(res, code, { success, reference, amount, status, raw }) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json({
    success: Boolean(success),
    reference: reference || '',
    amount: Number(amount || 0),
    status: status || 'UNKNOWN',
    raw: raw ?? null
  });
}

// ===== 5. HANDLER =====
module.exports = async (req, res) => {
  // cuma allow GET & POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return respond(res, 405, {
      success: false,
      reference: '',
      amount: 0,
      status: 'UNKNOWN',
      raw: { success: false, error: 'Method not allowed' }
    });
  }

  // --- parse input ---
  let reference = '';
  let amount = 0;

  try {
    if (req.method === 'GET') {
      reference = String(req.query.reference || '').trim();
      amount = Number(req.query.amount || 0);
    } else {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body || {});
      reference = String(body.reference || '').trim();
      amount = Number(body.amount || 0);
    }
  } catch (e) {
    return respond(res, 400, {
      success: false,
      reference,
      amount,
      status: 'UNKNOWN',
      raw: { success: false, error: 'Body / query tidak valid', detail: String(e.message || e) }
    });
  }

  if (!reference || !Number.isFinite(amount) || amount <= 0) {
    return respond(res, 400, {
      success: false,
      reference,
      amount,
      status: 'UNKNOWN',
      raw: { success: false, error: 'reference/amount tidak valid' }
    });
  }

  if (!CONFIG.auth_username || !CONFIG.auth_token) {
    return respond(res, 500, {
      success: false,
      reference,
      amount,
      status: 'UNKNOWN',
      raw: { success: false, error: 'ENV ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set' }
    });
  }

  if (!PaymentChecker || loaderError) {
    return respond(res, 500, {
      success: false,
      reference,
      amount,
      status: 'UNKNOWN',
      raw: {
        success: false,
        error: 'PaymentChecker tidak bisa diload dari autoft-qris',
        detail: String(loaderError && loaderError.message ? loaderError.message : loaderError)
      }
    });
  }

  // --- call PaymentChecker ---
  let raw;
  try {
    const checker = new PaymentChecker({
      auth_username: CONFIG.auth_username,
      auth_token: CONFIG.auth_token
    });

    raw = await checker.checkPaymentStatus(reference, amount);
  } catch (e) {
    // kalau HTTP error / network error dsb → bungkus jadi raw error
    raw = {
      success: false,
      error: 'Gagal cek status pembayaran: ' + String(e && e.message ? e.message : e)
    };
  }

  const status = normalizeStatus(raw);

  // SESUAI PERMINTAAN:
  // struktur SELALU:
  // { success: true/false, reference, amount, status, raw }
  return respond(res, 200, {
    success: true, // top-level tetap true, walau raw.success bisa false
    reference,
    amount,
    status,
    raw
  });
};
