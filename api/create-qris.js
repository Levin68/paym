// api/create-qris.js

const config = {
  storeName: process.env.STORE_NAME || 'NEVERMORE',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null
};

function generateReference(prefix = 'REF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
  return `${prefix}${ts}${rand}`.slice(0, 16);
}

let QRISGeneratorClass = null;

async function getGenerator(themeName) {
  if (!QRISGeneratorClass) {
    const m = await import('autoft-qris');
    const base = m.default || m;

    QRISGeneratorClass =
      base.QRISGenerator ||
      base.QRISGeneratorTheme1 ||
      base.QRISGeneratorDefault ||
      base;
  }

  const localConf = {
    storeName: config.storeName,
    auth_username: config.auth_username,
    auth_token: config.auth_token,
    baseQrString: config.baseQrString,
    logoPath: config.logoPath
  };

  return new QRISGeneratorClass(localConf, themeName);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed. Use POST.' });
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
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum di-set di Environment Vercel'
      });
    }

    const themeName = theme === 'theme2' ? 'theme2' : 'theme1';

    let generator;
    try {
      generator = await getGenerator(themeName);
    } catch (e) {
      console.error('ERROR import autoft-qris:', e);
      return res.status(500).json({
        success: false,
        stage: 'import-autoft-qris',
        message: e.message || 'Gagal load autoft-qris'
      });
    }

    const qrString = generator.generateQrString(nominal);
    const reference = generateReference();

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount: nominal,
        theme: themeName,
        qrString
      }
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      stage: 'handler',
      message: err.message || 'Internal server error di create-qris'
    });
  }
};
