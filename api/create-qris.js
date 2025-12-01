// api/create-qris.js

const { QRISGenerator } = require('autoft-qris');

const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  // kita TIDAK generate PNG di server, jadi logoPath ga kepake
  logoPath: null
};

function generateReference() {
  // ID simple aja, yang penting unik
  return 'REF' + Date.now();
}

module.exports = async (req, res) => {
  // Hanya boleh POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.'
    });
  }

  try {
    // Pastikan body ke-parse
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const nominal = Number(body.amount);

    if (!Number.isFinite(nominal) || nominal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount tidak valid'
      });
    }

    if (!config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum di-set di environment'
      });
    }

    // Pakai QRISGenerator dari autoft-qris
    const qrisGen = new QRISGenerator(
      {
        baseQrString: config.baseQrString,
        logoPath: null
      },
      'theme1' // ini cuma internal di lib, ga ngaruh ke client
    );

    // HANYA ambil string QRIS (tanpa PNG)
    const qrString = qrisGen.generateQrString(nominal);
    const reference = generateReference();

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount: nominal,
        qrString
      }
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  }
};
