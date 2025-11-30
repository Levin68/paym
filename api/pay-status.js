// api/pay-status.js

const fs = require('fs');
const path = require('path');

const _norm = (m) => (m && (m.default || m)) || m;

const autoftEntry = require.resolve('autoft-qris');
let pkgDir = path.dirname(autoftEntry);
while (pkgDir && path.basename(pkgDir) !== 'autoft-qris') {
  pkgDir = path.dirname(pkgDir);
}
const srcDir = fs.existsSync(path.join(pkgDir, 'src'))
  ? path.join(pkgDir, 'src')
  : pkgDir;

const PaymentChecker = _norm(require(path.join(srcDir, 'payment-checker.cjs')));

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed. Gunakan GET.'
      });
    }

    const { reference, amount } = req.query || {};
    const amt = Number(amount);

    if (!reference || !amt) {
      return res.status(400).json({
        success: false,
        message: 'reference dan amount wajib diisi.'
      });
    }

    const auth_username = (process.env.ORKUT_AUTH_USERNAME || '').trim();
    const auth_token = (process.env.ORKUT_AUTH_TOKEN || '').trim();

    if (!auth_username || !auth_token) {
      return res.status(500).json({
        success: false,
        message: 'ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set di Vercel.'
      });
    }

    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    const result = await checker.checkPaymentStatus(reference, amt);

    // Normalisasi biar front-end gampang
    if (!result || result.success === false) {
      return res.status(200).json({
        success: true,
        data: { status: 'UNPAID', raw: result || null }
      });
    }

    const data = result.data || result.result || result;
    const status = (data.status || data.payment_status || '').toString().toUpperCase() || 'UNPAID';

    return res.status(200).json({
      success: true,
      data: {
        status,
        raw: data
      }
    });
  } catch (err) {
    console.error('pay-status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error di pay-status: ' + err.message
    });
  }
};
