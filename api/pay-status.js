// api/pay-status.js

const _norm = (m) => (m && (m.default || m)) || m;

// ==== 1. Coba load PaymentChecker dari beberapa path berbeda ====
let PaymentChecker = null;
let loadError = null;

function tryLoadPaymentChecker() {
  if (PaymentChecker) return PaymentChecker;

  try {
    // 1) struktur paling umum: autoft-qris/src/payment-checker.cjs
    PaymentChecker = _norm(require('autoft-qris/src/payment-checker.cjs'));
    return PaymentChecker;
  } catch (e1) {
    loadError = e1;
  }

  try {
    // 2) kalau src nggak ada, coba langsung di root
    PaymentChecker = _norm(require('autoft-qris/payment-checker.cjs'));
    return PaymentChecker;
  } catch (e2) {
    loadError = e2;
  }

  try {
    // 3) fallback terakhir: root export (kalau dia pernah export PaymentChecker)
    const mod = require('autoft-qris');
    PaymentChecker = _norm(mod.PaymentChecker || mod.paymentChecker || null);
    if (PaymentChecker) return PaymentChecker;
  } catch (e3) {
    loadError = e3;
  }

  // kalau sampai sini masih gagal, biarin PaymentChecker = null
  return null;
}

// ==== 2. Config dari ENV ====
const config = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN
};

// ==== 3. Normalisasi hasil PaymentChecker -> status singkat ====
function normalizeResult(res) {
  if (!res || typeof res !== 'object') {
    return { status: 'UNKNOWN', raw: res };
  }

  let data = res.data || res.result || res;
  if (Array.isArray(data)) data = data[0] || {};

  const statusRaw =
    (data.status ||
      data.payment_status ||
      data.transaction_status ||
      '').toString();

  const status = statusRaw ? statusRaw.toUpperCase() : 'UNKNOWN';

  return {
    status,
    raw: res
  };
}

// ==== 4. Handler Vercel Function ====
module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // pastikan PaymentChecker sudah berhasil diloader
  const PC = tryLoadPaymentChecker();
  if (!PC) {
    return res.status(500).json({
      success: false,
      stage: 'load-payment-checker',
      message: 'PaymentChecker tidak bisa diload dari autoft-qris',
      detail: loadError ? String(loadError.message || loadError) : null
    });
  }

  // --- ambil reference & amount ---
  let reference = '';
  let amount = 0;

  try {
    if (req.method === 'GET') {
      reference = (req.query.reference || '').toString().trim();
      amount = Number(req.query.amount || 0);
    } else {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body || {});
      reference = (body.reference || '').toString().trim();
      amount = Number(body.amount || 0);
    }
  } catch (e) {
    return res.status(400).json({
      success: false,
      stage: 'parse-body',
      message: 'Body / query tidak valid'
    });
  }

  if (!reference) {
    return res.status(400).json({
      success: false,
      stage: 'validate',
      message: 'reference wajib diisi'
    });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      stage: 'validate',
      message: 'amount tidak valid'
    });
  }

  if (!config.auth_username || !config.auth_token) {
    return res.status(500).json({
      success: false,
      stage: 'config',
      message:
        'ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set di environment'
    });
  }

  // --- panggil PaymentChecker ke API OrderKuota ---
  try {
    const checker = new PC({
      auth_token: config.auth_token,
      auth_username: config.auth_username
    });

    const rawResult = await checker.checkPaymentStatus(reference, amount);
    const norm = normalizeResult(rawResult);

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount,
        status: norm.status
      },
      raw: norm.raw
    });
  } catch (err) {
    console.error('pay-status runtime error:', err);
    return res.status(500).json({
      success: false,
      stage: 'check-payment',
      message: err.message || 'Internal server error',
      stack: err.stack
    });
  }
};
