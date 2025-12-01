// api/pay-status.js

// Ambil PaymentChecker langsung dari package, sesuai README autoft-qris:
// const { PaymentChecker } = require('autoft-qris');
let PaymentChecker;
try {
  const mod = require('autoft-qris');
  PaymentChecker = mod.PaymentChecker;
} catch (e) {
  console.error('Gagal require autoft-qris:', e);
}

// Konfigurasi dari ENV (HARUS di-set di Vercel)
const config = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN
};

// Normalisasi hasil PaymentChecker -> status yang rapi
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

module.exports = async (req, res) => {
  // script.js pakai GET, tapi boleh juga POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // Pastikan PaymentChecker kebaca
  if (!PaymentChecker) {
    return res.status(500).json({
      success: false,
      stage: 'require-autoft-qris',
      message: 'PaymentChecker tidak ditemukan di autoft-qris'
    });
  }

  // --- Ambil reference & amount ---
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

  // --- Panggil PaymentChecker ke API OrderKuota ---
  try {
    const checker = new PaymentChecker({
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
        status: norm.status  // ini yang dibaca script.js (PAID / UNPAID / dst)
      },
      raw: norm.raw // buat debug di Network tab
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
