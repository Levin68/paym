// api/create-qris.js

const fs = require('fs');
const path = require('path');

// helper buat ambil modul .cjs dari autoft-qris (biar nggak error ESM)
const _norm = (m) => (m && (m.default || m)) || m;

const autoftEntry = require.resolve('autoft-qris');
let pkgDir = path.dirname(autoftEntry);
while (pkgDir && path.basename(pkgDir) !== 'autoft-qris') {
  pkgDir = path.dirname(pkgDir);
}
const srcDir = fs.existsSync(path.join(pkgDir, 'src'))
  ? path.join(pkgDir, 'src')
  : pkgDir;

const QRISGenerator = _norm(require(path.join(srcDir, 'qr-generator.cjs')));

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed. Gunakan POST.'
      });
    }

    const { amount } = req.body || {};
    const amt = Number(amount);

    if (!amt || amt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal tidak valid.'
      });
    }

    const baseQrString = (process.env.BASE_QR_STRING || '').trim();
    if (!baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum di-set di Environment Variables Vercel.'
      });
    }

    // config minimal sesuai README autoft-qris
    const config = {
      baseQrString,
      storeName: process.env.STORE_NAME || 'LevPay'
    };

    const qrisGen = new QRISGenerator(config, 'theme1');
    const qrString = qrisGen.generateQrString(amt);

    // ref simple, cukup unik untuk demo
    const reference = 'REF' + Date.now();

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount: amt,
        qrString
      }
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error di create-qris: ' + err.message
    });
  }
};
