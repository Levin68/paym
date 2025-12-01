// api/create-qris.js
// Handler CommonJS untuk Vercel

const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null
};

// generate reference ID pendek
function generateRef(prefix = 'REF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
  return (prefix + ts + rand).slice(0, 16);
}

module.exports = async (req, res) => {
  // === sementara: izinkan GET maupun POST biar gampang ngetes ===
  const method = req.method || 'GET';

  let nominal = 0;

  if (method === 'POST') {
    try {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : (req.body || {});
      nominal = Number(body.amount);
    } catch (e) {
      return res.status(400).json({
        success: false,
        stage: 'parse-body',
        message: 'Body tidak valid / bukan JSON'
      });
    }
  } else {
    // kalau dibuka langsung di browser (GET) pakai nominal default
    nominal = Number(req.query.amount || 1000);
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
      message: 'BASE_QR_STRING belum di-set di env'
    });
  }

  // === require autoft-qris DI DALAM HANDLER ===
  let QRISGenerator;
  try {
    const mod = require('autoft-qris');
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
      // stack sengaja dikirim biar gampang debug
      stack: e.stack
    });
  }

  try {
    // selalu pakai theme1 aja
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
        // kalau mau dipakai, ini sudah siap sebagai <img src="...">
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
