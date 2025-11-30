// api/check-payment.js

const fs = require('fs');
const path = require('path');

// helper sama kaya di bot
const _norm = (m) => (m && (m.default || m)) || m;

// cari folder autoft-qris di node_modules
const autoftEntry = require.resolve('autoft-qris');
let pkgDir = path.dirname(autoftEntry);
while (pkgDir && path.basename(pkgDir) !== 'autoft-qris') {
  pkgDir = path.dirname(pkgDir);
}
const srcDir = fs.existsSync(path.join(pkgDir, 'src'))
  ? path.join(pkgDir, 'src')
  : pkgDir;

// load PaymentChecker langsung dari src/payment-checker.cjs
const PaymentChecker = _norm(
  require(path.join(srcDir, 'payment-checker.cjs'))
);

module.exports = async (req, res) => {
  // Frontend kamu pakai GET, jadi kita izinkan GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan GET.'
    });
  }

  const { reference, amount } = req.query;

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Parameter reference dan amount wajib diisi.'
    });
  }

  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount tidak valid.'
    });
  }

  const auth_username = process.env.ORKUT_AUTH_USERNAME;
  const auth_token = process.env.ORKUT_AUTH_TOKEN;

  if (!auth_username || !auth_token) {
    return res.status(500).json({
      success: false,
      message:
        'Env ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum diset di Project Settings Vercel.'
    });
  }

  try {
    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    // call bener-bener sama kayak di bot: (ref, amount)
    const result = await checker.checkPaymentStatus(reference, numericAmount);

    // biasanya bentuknya { success, data, message }
    return res.status(200).json(result);
  } catch (err) {
    console.error('[check-payment] error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal cek status pembayaran: ' + err.message
    });
  }
};