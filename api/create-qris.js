// api/create-qris.js
const { QRISGenerator } = require('autoft-qris');

// Config dari ENV (isi di Vercel)
const config = {
  storeName: process.env.STORE_NAME || 'LevPay',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: process.env.BASE_QR_STRING
  // logoPath & theme gak dipakai, kita cuma butuh string
};

const qrisGen = new QRISGenerator(config, 'theme1'); // theme ga ngaruh ke string

function makeReference() {
  return 'REF' + Date.now();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const amount = Number(body.amount);

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Nominal tidak valid' });
    }

    const reference = makeReference();

    // Yang penting: generate QRIS string dari amount
    const qrString = qrisGen.generateQrString(amount);

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount,
        qrString
      }
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat QRIS'
    });
  }
};