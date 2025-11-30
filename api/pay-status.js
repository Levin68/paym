// api/pay-status.js
// CJS style – cocok sama environment Vercel Node 20

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const _norm = (m) => (m && (m.default || m)) || m;

// cari folder autoft-qris/src
const autoftEntry = require.resolve('autoft-qris');
let pkgDir = path.dirname(autoftEntry);
while (pkgDir && path.basename(pkgDir) !== 'autoft-qris') {
  pkgDir = path.dirname(pkgDir);
}
const srcDir = fs.existsSync(path.join(pkgDir, 'src'))
  ? path.join(pkgDir, 'src')
  : pkgDir;

const PaymentChecker = _norm(
  require(path.join(srcDir, 'payment-checker.cjs'))
);

// ====== NORMALIZER (copy dari helper bot WA) ======
function normalizeCheckerResult(res) {
  if (!res || typeof res !== 'object') return null;
  if (res.success === false || res.error) return null;
  if (typeof res.status === 'number' && res.status >= 400) return null;

  let data = res.data || res.result || res;
  if (Array.isArray(data)) data = data[0] || {};
  if (!data || typeof data !== 'object') return null;

  const status = (
    data.status ||
    data.payment_status ||
    data.transaction_status ||
    ''
  )
    .toString()
    .toUpperCase();

  const amount = Number(
    data.amount ||
      data.gross_amount ||
      data.total ||
      data.nominal ||
      0
  );

  const ref = (
    data.ref ||
    data.reference ||
    data.order_id ||
    data.transaction_id ||
    ''
  )
    .toString()
    .trim();

  const paidAt =
    data.date ||
    data.paid_at ||
    data.paidAt ||
    data.transaction_time ||
    data.settled_at ||
    null;

  return { status, amount, ref, paidAt, raw: res };
}

// ====== HTTP HANDLER ======
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const { ref, amount } = req.query;
  const nominal = amount ? Number(amount) : undefined;

  if (!ref) {
    // frontend selalu kirim ref, tapi guard aja
    return res
      .status(400)
      .json({ success: false, message: 'ref wajib diisi' });
  }

  try {
    const checker = new PaymentChecker({
      auth_token: process.env.ORKUT_AUTH_TOKEN,
      auth_username: process.env.ORKUT_AUTH_USERNAME
    });

    const apiRes = await checker.checkPaymentStatus(ref, nominal);
    const n = normalizeCheckerResult(apiRes);

    // log buat ngecek bentuk data aslinya di Vercel
    try {
      console.log(
        chalk.cyan(
          `[PAY_STATUS] ref=${ref} amt=${nominal} norm-status=${
            n ? n.status : 'null'
          } raw=${JSON.stringify(apiRes).slice(0, 300)}...`
        )
      );
    } catch (e) {
      console.log('[PAY_STATUS]', ref, nominal);
    }

    // selalu kirim 200 supaya frontend bisa mutusin sendiri
    return res.status(200).json({
      success: true,
      ref: n && n.ref ? n.ref : null,
      amount: n && Number.isFinite(n.amount) ? n.amount : null,
      status: n ? n.status : null,
      paidAt: n ? n.paidAt : null,
      normalized: n,
      raw: apiRes
    });
  } catch (err) {
    console.error('pay-status error:', err);
    return res.status(500).json({
      success: false,
      error: true,
      message: err.message || 'Internal server error'
    });
  }
};
