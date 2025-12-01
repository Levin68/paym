// api/pay-status.js

// Konfigurasi dari ENV
const config = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN
};

// bantu normalisasi response dari PaymentChecker
function normalizeResult(res) {
  if (!res || typeof res !== 'object') return { status: 'UNKNOWN', raw: res };

  let data = res.data || res.result || res;
  if (Array.isArray(data)) data = data[0] || {};

  const status =
    (data.status ||
      data.payment_status ||
      data.transaction_status ||
      '').toString().toUpperCase() || 'UNKNOWN';

  return {
    status,
    raw: res
  };
}

module.exports = async (req, res) => {
  // script.js pakai GET, tapi kalau mau POST juga bisa
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
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

  // --- require autoft-qris di dalam handler ---
  let PaymentChecker;
  try {
    const mod = require('autoft-qris');
    PaymentChecker = mod.PaymentChecker;

    if (!PaymentChecker) {
      throw new Error('PaymentChecker tidak ditemukan di autoft-qris');
    }
  } catch (e) {
    console.error('Gagal require autoft-qris (PaymentChecker):', e);
    return res.status(500).json({
      success: false,
      stage: 'require-autoft-qris',
      message: e.message,
      stack: e.stack
    });
  }

  // --- panggil API cek payment ---
  try {
    const checker = new PaymentChecker({
      auth_token: config.auth_token,
      auth_username: config.auth_username
    });

    const rawResult = await checker.checkPaymentStatus(reference, amount);
    const norm = normalizeResult(rawResult);

    // norm.status bisa: PAID, UNPAID, dll tergantung API OrderKuota
    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount,
        status: norm.status
      },
      raw: norm.raw // kalau mau debug di network tab
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
