// api/pay-status.js

const _norm = (m) => (m && (m.default || m)) || m;

// =========================
// 1. Loader PaymentChecker (ESM)
// =========================

let paymentCheckerPromise = null;
let lastLoadError = null;

async function getPaymentChecker() {
  if (paymentCheckerPromise) return paymentCheckerPromise;

  paymentCheckerPromise = (async () => {
    try {
      // 1) coba path ESM spesifik dulu
      try {
        const m1 = await import('autoft-qris/src/payment-checker.mjs');
        const C1 = _norm(m1.PaymentChecker || m1.default || m1);
        if (C1) return C1;
      } catch (e1) {
        lastLoadError = e1;
      }

      // 2) coba kalau ada di root paket
      try {
        const m2 = await import('autoft-qris/payment-checker.mjs');
        const C2 = _norm(m2.PaymentChecker || m2.default || m2);
        if (C2) return C2;
      } catch (e2) {
        lastLoadError = e2;
      }

      // 3) fallback: export dari index autoft-qris
      try {
        const m3 = await import('autoft-qris');
        const C3 = _norm(
          m3.PaymentChecker ||
          m3.paymentChecker ||
          (m3.default && (m3.default.PaymentChecker || m3.default.paymentChecker))
        );
        if (C3) return C3;
      } catch (e3) {
        lastLoadError = e3;
      }

      throw lastLoadError || new Error('PaymentChecker tidak ditemukan');
    } catch (e) {
      lastLoadError = e;
      throw e;
    }
  })();

  return paymentCheckerPromise;
}

// =========================
// 2. Config ENV
// =========================

const config = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN
};

// =========================
/** Normalisasi hasil PaymentChecker -> {status, raw} */
// =========================
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

// =========================
// 3. Handler Vercel
// =========================

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // --- load PaymentChecker via dynamic import ---
  let PC;
  try {
    PC = await getPaymentChecker();
  } catch (e) {
    return res.status(500).json({
      success: false,
      stage: 'load-payment-checker',
      message: 'PaymentChecker tidak bisa diload dari autoft-qris',
      detail: String(e && e.message ? e.message : e)
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

  // --- panggil PaymentChecker ke API AutoFT / OrderKuota ---
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
