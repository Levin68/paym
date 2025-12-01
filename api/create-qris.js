// api/create-qris.js

const { QRISGenerator } = require('autoft-qris');

const config = {
  // WAJIB: di-set di Vercel → Settings → Environment Variables
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null,
};

function generateRef(prefix = 'REF') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6)
    .toString(36)
    .toUpperCase();
  // max 16 char biar pendek
  return (prefix + ts + rand).slice(0, 16);
}

module.exports = async (req, res) => {
  // HANYA TERIMA POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    // body bisa string / object tergantung Vercel
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const body = rawBody ? JSON.parse(rawBody) : {};
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Amount tidak valid' });
    }

    if (!config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum di-set di Environment Vercel',
      });
    }

    // bikin generator
    const qrisGen = new QRISGenerator(config, 'theme1');

    // QR string + buffer PNG
    const qrString = qrisGen.generateQrString(amount);
    const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

    const reference = generateRef();
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount,
        qrString,
        // kalau mau dipakai nanti tinggal pakai <img src="...">
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
