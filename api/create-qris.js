// api/create-qris.js

// --- KONFIGURASI DARI ENV ---
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

// cache supaya nggak require berkali-kali
let QRISGeneratorClass = null;

function getGenerator(theme = 'theme1') {
  if (!QRISGeneratorClass) {
    // 👉 PENTING: pakai entry utama package, BUKAN /src/...
    const mod = require('autoft-qris');

    // coba beberapa kemungkinan export
    QRISGeneratorClass =
      mod.QRISGenerator ||
      mod.default ||
      mod.QRISGeneratorTheme1 ||
      mod.QRISGeneratorDefault ||
      mod;
  }

  const localConf = { ...config };
  return new QRISGeneratorClass(localConf, theme === 'theme2' ? 'theme2' : 'theme1');
}

module.exports = async (req, res) => {
  // biar kalau dibuka di browser langsung (GET) nggak crash
  if (req.method === 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Gunakan POST /api/create-qris',
      method: 'GET'
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ success: false, message: 'Method tidak diizinkan' });
  }

  try {
    // body kadang sudah objek, kadang string (tergantung Vercel)
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const { amount, theme = 'theme1' } = body;
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

    let qrisGen;
    try {
      qrisGen = getGenerator(theme);
    } catch (e) {
      console.error('ERROR load autoft-qris:', e);
      return res.status(500).json({
        success: false,
        stage: 'load-autoft-qris',
        message: e.message
      });
    }

    const qrString = qrisGen.generateQrString(nominal);
    const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

    const ref = generateRef();
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      data: {
        reference: ref,
        amount: nominal,
        theme: theme === 'theme2' ? 'theme2' : 'theme1',
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
