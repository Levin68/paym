// api/create-qris.js
// Endpoint: POST /api/create-qris
// Body: { "amount": 1000 }

const { QRISGenerator } = require('autoft-qris');

const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null
};

function generateRef(prefix = 'REF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
  return `${prefix}${ts}${rand}`.slice(0, 16);
}

module.exports = async (req, res) => {
  // HARUS POST – kalau diakses GET dari browser, wajar dapat 405
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
      return res
        .status(500)
        .json({ success: false, message: 'BASE_QR_STRING belum di-set' });
    }

    // Pakai 1 theme default saja (misal 'theme1'), nggak usah dioper dari front-end
    const gen = new QRISGenerator(config, 'theme1');

    const qrString = gen.generateQrString(nominal);
    const qrBuffer = await gen.generateQRWithLogo(qrString);

    const reference = generateRef();
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      data: {
        reference,      // dipakai di script.js -> currentRef
        amount: nominal,
        qrString,
        qrImage: `data:image/png;base64,${qrBase64}`
      }
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      stage: 'handler',
      message: err.message || 'Internal server error'
    });
  }
};
