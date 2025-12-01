const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null
};

// Ubah generateRef untuk memakai format custom
function generateRef(prefix = 'LEVPAY') {
  const rand = Math.floor(Math.random() * 100).toString().padStart(5, '0');  // Nomor acak 5 digit
  return `${prefix}${rand}`;  // Format baru: LEVPAY00001
}

// cache supaya nggak import berkali-kali
let QRTheme1Class = null;
let QRTheme2Class = null;

async function getGenerator(theme) {
  const useTheme2 = theme === 'theme2';

  if (!QRTheme1Class) {
    const m1 = await import('autoft-qris/src/qr-generator.mjs');
    QRTheme1Class = m1.default || m1.QRISGeneratorTheme1 || m1.QRISGenerator || m1.QRISGeneratorDefault;
  }

  if (!QRTheme2Class) {
    const m2 = await import('autoft-qris/src/qr-generator2.mjs');
    QRTheme2Class = m2.default || m2.QRISGeneratorTheme2 || m2.QRISGenerator || m2.QRISGeneratorDefault;
  }

  const Cls = useTheme2 ? QRTheme2Class : QRTheme1Class;
  const localConf = { ...config };
  return new Cls(localConf, useTheme2 ? 'theme2' : 'theme1');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  try {
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
      return res
        .status(500)
        .json({ success: false, message: 'BASE_QR_STRING belum di-set' });
    }

    let qrisGen;
    try {
      qrisGen = await getGenerator(theme);
    } catch (e) {
      console.error('ERROR import qr-generator modules:', e);
      return res.status(500).json({
        success: false,
        stage: 'import-qr-generator',
        message: e.message,
        stack: e.stack
      });
    }

    const qrString = qrisGen.generateQrString(nominal);
    const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

    const ref = generateRef();  // Menggunakan format custom LEVPAY00001
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      data: {
        ref,
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
      message: err.message || 'Internal server error',
      stack: err.stack
    });
  }
};
