// api/create-qris.js

const { QRISGenerator } = require('autoft-qris');

const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null,
};

function generateRef(prefix = 'REF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
  return (prefix + ts + rand).slice(0, 16);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const { amount } = body;
    const nominal = Number(amount);

    if (!Number.isFinite(nominal) || nominal <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Amount tidak valid' });
    }

    if (!config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum di-set di ENV / Vercel',
      });
    }

    // pakai autoft-qris langsung dari entry utama, ga usah import path src
    const qrisGen = new QRISGenerator(config, 'theme1');
    const qrString = qrisGen.generateQrString(nominal);

    const reference = generateRef();

    return res.status(200).json({
      success: true,
      data: {
        reference,        // dipakai di front-end
        amount: nominal,
        qrString,         // string QRIS mentah, nanti di-render oleh qrcodejs di browser
      },
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  }
};
