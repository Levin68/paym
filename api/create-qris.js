// /api/create-qris.js
const { QRISGenerator } = require('autoft-qris');

const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null, // kalau mau pakai logo bisa diatur nanti
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { amount, theme = 'theme1' } = req.body || {};
    const nominal = Number(amount);

    if (!Number.isFinite(nominal) || nominal <= 0) {
      return res.status(400).json({ success: false, message: 'Amount tidak valid' });
    }
    if (!config.baseQrString) {
      return res.status(500).json({ success: false, message: 'BASE_QR_STRING belum di-set' });
    }

    const qrisGen = new QRISGenerator(config, theme === 'theme2' ? 'theme2' : 'theme1');

    const qrString = qrisGen.generateQrString(nominal);
    const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

    const reference = 'REF' + Date.now();

    // kirim balik sebagai base64 supaya gampang ditampilkan di browser
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      data: {
        ref: reference,
        amount: nominal,
        theme,
        qrString,
        qrImage: `data:image/png;base64,${qrBase64}`,
      },
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal error' });
  }
};
