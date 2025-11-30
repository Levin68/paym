// api/pay-status.js
const fs = require('fs');
const path = require('path');

const _norm = (m) => (m && (m.default || m)) || m;

let PaymentCheckerClass = null;

function resolvePaymentChecker() {
  if (PaymentCheckerClass) return PaymentCheckerClass;

  // Cari folder paket autoft-qris di node_modules
  const autoftEntry = require.resolve('autoft-qris');
  let pkgDir = path.dirname(autoftEntry);
  while (pkgDir && path.basename(pkgDir) !== 'autoft-qris') {
    const parent = path.dirname(pkgDir);
    if (parent === pkgDir) break;
    pkgDir = parent;
  }

  const candidates = [
    path.join(pkgDir, 'src', 'payment-checker.cjs'),
    path.join(pkgDir, 'payment-checker.cjs'),
    path.join(pkgDir, 'src', 'payment-checker.js'),
    path.join(pkgDir, 'payment-checker.js')
  ];

  let chosen = null;
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      chosen = file;
      break;
    }
  }

  if (!chosen) {
    throw new Error(
      'autoft-qris PaymentChecker module tidak ditemukan (coba upgrade autoft-qris ke 0.0.9).'
    );
  }

  PaymentCheckerClass = _norm(require(chosen));
  return PaymentCheckerClass;
}

const PAID_STATUSES = new Set([
  'PAID',
  'SUCCESS',
  'COMPLETED',
  'SETTLEMENT',
  'CAPTURE',
  'CONFIRMED',
  'SUCCESSFUL',
  'PAID_OFF',
  'DONE',
  'BERHASIL',
  'SUKSES'
]);

function upper(x) {
  return typeof x === 'string' ? x.toUpperCase() : '';
}

function normalizePaymentResult(apiRes, fallbackRef, fallbackAmount) {
  if (!apiRes || typeof apiRes !== 'object') {
    return {
      success: false,
      status: 'UNKNOWN',
      message: 'Response kosong / bukan object',
      raw: apiRes
    };
  }

  const root = apiRes;
  let data =
    root.data ||
    root.result ||
    root.transaction ||
    root.payment ||
    root;

  if (Array.isArray(data)) data = data[0] || {};

  const candidatesStatus = [
    data && data.status,
    data && data.payment_status,
    data && data.transaction_status,
    root && root.status_text,
    root && root.status
  ].map(upper);

  let status = 'PENDING';

  for (const s of candidatesStatus) {
    if (!s) continue;
    if (PAID_STATUSES.has(s) || /PAID|SUCCESS|BERHASIL|LUNAS/.test(s)) {
      status = 'PAID';
      break;
    }
    if (/FAILED|CANCEL|EXPIRED|GAGAL/.test(s)) {
      status = 'FAILED';
      break;
    }
    if (/PENDING|WAITING|MENUNGGU/.test(s)) {
      status = 'PENDING';
    }
  }

  const ref =
    (data &&
      (data.ref ||
        data.reference ||
        data.order_id ||
        data.transaction_id)) ||
    fallbackRef ||
    null;

  const amount =
    Number(
      (data &&
        (data.amount ||
          data.nominal ||
          data.total ||
          data.gross_amount)) ||
      fallbackAmount ||
      0
    ) || 0;

  const paidAt =
    (data &&
      (data.paid_at ||
        data.paidAt ||
        data.date ||
        data.transaction_time ||
        data.settled_at)) ||
    null;

  return {
    success: true,
    status,
    rawStatus: candidatesStatus.find(Boolean) || null,
    ref,
    amount,
    paidAt,
    raw: apiRes
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const { ref, amount } = req.query;

  if (!ref) {
    res.status(400).json({ success: false, message: 'param "ref" wajib ada' });
    return;
  }

  const auth_token = process.env.ORKUT_AUTH_TOKEN;
  const auth_username = process.env.ORKUT_AUTH_USERNAME;

  if (!auth_token || !auth_username) {
    res.status(500).json({
      success: false,
      stage: 'env',
      message: 'ORKUT_AUTH_TOKEN / ORKUT_AUTH_USERNAME belum di-set'
    });
    return;
  }

  let PaymentChecker;
  try {
    PaymentChecker = resolvePaymentChecker();
  } catch (err) {
    console.error('[pay-status] gagal load PaymentChecker:', err);
    res.status(500).json({
      success: false,
      stage: 'require-autoft-qris',
      message: err.message
    });
    return;
  }

  try {
    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    // amount bisa kosong, tapi kita kirim kalau ada
    const amtNum = amount ? Number(amount) : undefined;
    const apiRes = await checker.checkPaymentStatus(ref, amtNum);

    const normalized = normalizePaymentResult(apiRes, ref, amtNum);

    res.status(200).json(normalized);
  } catch (err) {
    console.error('[pay-status] error saat call checkPaymentStatus:', err);
    res.status(500).json({
      success: false,
      stage: 'call-payment-checker',
      message: err.message
    });
  }
};
