// api/create-qris.js

const { QRISGenerator } = require('autoft-qris');

// konfigurasi dari ENV
const config = {
  storeName: process.env.STORE_NAME || 'LEVPAY',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null,
};

// === REF: LEVPAY00001 dst. ===
let refCounter = 1;
function nextRef() {
  const num = String(refCounter++).padStart(5, '0'); // 00001, 00002, ...
  return `LEVPAY${num}`;
}

module.exports = async (req, res) => {
  // cuma boleh POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan POST.',
    });
  }

  try {
    console.log('[create-qris] incoming body =', req.body);

    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const amount = Number(body.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Amount tidak valid' });
    }

    if (!config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum di-set di ENV',
      });
    }

    // bikin generator (tanpa tema / logo ribet)
    const qrisGen = new QRISGenerator(
      {
        baseQrString: config.baseQrString,
        logoPath: null,
      },
      'theme1'
    );

    // string QRIS + PNG buffer
    const qrString = qrisGen.generateQrString(amount);
    const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

    const ref = nextRef();
    const qrBase64 = qrBuffer.toString('base64');

    console.log('[create-qris] OK ref=', ref, 'amount=', amount);

    return res.status(200).json({
      success: true,
      data: {
        ref,
        amount,
        qrString,
        qrImage: `data:image/png;base64,${qrBase64}`,
      },
    });
  } catch (err) {
    console.error('[create-qris] ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal error',
    });
  }
};
