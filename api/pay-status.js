// api/pay-status.js

const fs = require('fs');
const path = require('path');

// sama kayak versi bot: helper buat normalisasi module
const _norm = (m) => (m && (m.default || m)) || m;

// cari folder package autoft-qris, lalu ambil /src
const autoftEntry = require.resolve('autoft-qris');
let pkgDir = path.dirname(autoftEntry);
while (pkgDir && path.basename(pkgDir) !== 'autoft-qris') {
  pkgDir = path.dirname(pkgDir);
}
const srcDir = fs.existsSync(path.join(pkgDir, 'src'))
  ? path.join(pkgDir, 'src')
  : pkgDir;

// ambil PaymentChecker dari file internal, persis kayak di bot
const PaymentChecker = _norm(require(path.join(srcDir, 'payment-checker.cjs')));

// Konfigurasi dari ENV
const config = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN
};

// bantu normalisasi response dari PaymentChecker
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
  // script.js pakai GET, tapi kalau mau POST juga boleh
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

  // --- panggil PaymentChecker: sama persis konsepnya dengan versi bot ---
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
        status: norm.status // ini yg dibaca script.js -> PAID / UNPAID / dsb
      },
      raw: norm.raw // buat debug di Network tab kalau perlu
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
