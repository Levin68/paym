// api/create-qris.js

// Konfigurasi dari ENV (Vercel -> Project Settings -> Environment Variables)
const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null
};

// bikin reference ID pendek
function generateRef(prefix = 'REF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
  return (prefix + ts + rand).slice(0, 16);
}

// handler utama
module.exports = async (req, res) => {
  // boleh GET buat test manual di browser, tapi POST buat real use
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // --- ambil amount ---
  let nominal = 0;

  try {
    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body || {});
      nominal = Number(body.amount);
    } else {
      // GET: /api/create-qris?amount=1000 buat ngetes di browser
      nominal = Number(req.query.amount || 1000);
    }
  } catch (e) {
    return res.status(400).json({
      success: false,
      stage: 'parse-body',
      message: 'Body tidak valid / bukan JSON'
    });
  }

  if (!Number.isFinite(nominal) || nominal <= 0) {
    return res.status(400).json({
      success: false,
      stage: 'validate-amount',
      message: 'Amount tidak valid'
    });
  }

  if (!config.baseQrString) {
    return res.status(500).json({
      success: false,
      stage: 'config',
      message: 'BASE_QR_STRING belum di-set di environment'
    });
  }

  // --- require autoft-qris DI DALAM handler, biar kalau error kebaca sebagai JSON ---
  let QRISGenerator;
  try {
    const mod = require('autoft-qris');          // pakai CommonJS
    QRISGenerator = mod.QRISGenerator || mod.default;

    if (!QRISGenerator) {
      throw new Error('QRISGenerator tidak ditemukan di autoft-qris');
    }
  } catch (e) {
    console.error('Gagal require autoft-qris:', e);
    return res.status(500).json({
      success: false,
      stage: 'require-autoft-qris',
      message: e.message,
      stack: e.stack
    });
  }

  // --- generate QR ---
  try {
    // kita selalu pakai “theme1” saja, simple
    const qrisGen = new QRISGenerator(config, 'theme1');

    const qrString = qrisGen.generateQrString(nominal);
    const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

    const reference = generateRef();
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount: nominal,
        qrString,
        // kalau mau dipakai di <img>, tinggal set src ke sini
        qrImage: `data:image/png;base64,${qrBase64}`
      }
    });
  } catch (err) {
    console.error('create-qris runtime error:', err);
    return res.status(500).json({
      success: false,
      stage: 'generate',
      message: err.message || 'Internal server error',
      stack: err.stack
    });
  }
};
