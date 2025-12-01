// api/create-qris.js

const { QRISGenerator } = require('autoft-qris');

// --- CONFIG DARI ENV ---
const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null, // kalau mau pakai logo, isi path-nya di sini
};

// Simple reference generator
function generateRef(prefix = 'REF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
  return `${prefix}${ts}${rand}`.slice(0, 16);
}

// cache 1 instance biar nggak bikin generator terus-terusan
let qrisGen = null;
function getGenerator() {
  if (!qrisGen) {
    qrisGen = new QRISGenerator(
      {
        storeName: config.storeName,
        auth_username: config.auth_username,
        auth_token: config.auth_token,
        baseQrString: config.baseQrString,
        logoPath: config.logoPath,
      },
      'theme1' // tema default; nggak usah dioper ke front-end
    );
  }
  return qrisGen;
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
        .json({ success: false, message: 'Amount tidak valid.' });
    }

    if (!config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum di-set di ENV.',
      });
    }

    const generator = getGenerator();

    // dari library autoft-qris
    const qrString = generator.generateQrString(nominal);
    const qrBuffer = await generator.generateQRWithLogo(qrString);

    const reference = generateRef();
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount: nominal,
        qrString,
        // kalau mau langsung pakai <img>, boleh pakai ini:
        qrImage: `data:image/png;base64,${qrBase64}`,
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
