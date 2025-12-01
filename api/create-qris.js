// api/create-qris.js

const config = {
  storeName: process.env.STORE_NAME || 'LEVPAY',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null,
};

// --- REF: LEVPAY00001, LEVPAY00002, dst. ---
let refCounter = 1;
function nextRef() {
  const num = String(refCounter++).padStart(5, '0'); // 00001, 00002, ...
  return `LEVPAY${num}`;
}

// cache class biar import nggak berulang
let QRTheme1Class = null;

async function getGenerator() {
  if (!QRTheme1Class) {
    // PAKAI FILE YANG SAMA PERSIS kayak lib aslinya
    const m = await import('autoft-qris/src/qr-generator.mjs');
    QRTheme1Class =
      m.default ||
      m.QRISGenerator ||
      m.QRISGeneratorTheme1 ||
      m.QRISGeneratorDefault;
  }

  // config minimal (tanpa logo, tanpa tema ribet)
  const localConf = {
    baseQrString: config.baseQrString,
    logoPath: null,
    storeName: config.storeName,
  };

  return new QRTheme1Class(localConf, 'theme1');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan POST.',
    });
  }

  try {
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

    let qrisGen;
    try {
      qrisGen = await getGenerator();
    } catch (e) {
      console.error('[create-qris] Gagal import qr-generator:', e);
      return res.status(500).json({
        success: false,
        message: 'Gagal load modul autoft-qris',
        detail: e.message,
      });
    }

    const qrString = qrisGen.generateQrString(amount);
    const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

    const reference = nextRef();
    const qrBase64 = qrBuffer.toString('base64');

    console.log('[create-qris] OK', { reference, amount });

    return res.status(200).json({
      success: true,
      data: {
        reference,          // contoh: LEVPAY00001
        amount,             // nominal
        qrString,           // string QRIS mentah
        qrImage: `data:image/png;base64,${qrBase64}`, // PNG base64
      },
    });
  } catch (err) {
    console.error('[create-qris] ERROR handler:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  }
};
