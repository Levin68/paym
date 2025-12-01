// api/create-qris.js

const { QRISGenerator } = require('autoft-qris');

const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null
};

function generateReference(prefix = 'REF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
  // 16 char cukup buat ID pendek
  return `${prefix}${ts}${rand}`.slice(0, 16);
}

module.exports = async (req, res) => {
  // Hanya boleh POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    // body bisa sudah object, bisa juga string mentah
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const { amount, theme = 'theme1' } = body;
    const nominal = Number(amount);

    if (!Number.isFinite(nominal) || nominal <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Amount tidak valid' });
    }

    if (!config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum di-set di Environment Vercel'
      });
    }

    // theme1 / theme2 (sesuai autoft-qris)
    const themeName = theme === 'theme2' ? 'theme2' : 'theme1';

    // pakai API resmi dari package
    const generator = new QRISGenerator(
      {
        storeName: config.storeName,
        auth_username: config.auth_username,
        auth_token: config.auth_token,
        baseQrString: config.baseQrString,
        logoPath: config.logoPath
      },
      themeName
    );

    // cuma butuh string QRIS, browser yg generate gambar
    const qrString = generator.generateQrString(nominal);
    const reference = generateReference();

    return res.status(200).json({
      success: true,
      data: {
        reference,          // <== sama seperti yg dipakai di js/script.js
        amount: nominal,
        theme: themeName,
        qrString
      }
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error di create-qris'
    });
  }
};
