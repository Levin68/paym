// api/create-qris.js

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.'
    });
  }

  // 1) Coba load autoft-qris DI DALAM handler
  let QRISGenerator;
  try {
    ({ QRISGenerator } = require('autoft-qris'));
  } catch (err) {
    console.error('Gagal load autoft-qris:', err);
    return res.status(500).json({
      success: false,
      message: 'Server gagal load library autoft-qris: ' + (err.message || String(err))
    });
  }

  try {
    const body = req.body || {};
    const amount = Number(body.amount || 0);

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal tidak valid'
      });
    }

    const config = {
      storeName: process.env.STORE_NAME || 'LevPay',
      auth_username: process.env.ORKUT_AUTH_USERNAME,
      auth_token: process.env.ORKUT_AUTH_TOKEN,
      baseQrString: process.env.BASE_QR_STRING
    };

    if (!config.auth_username || !config.auth_token || !config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'ENV server belum lengkap (auth_username, auth_token, baseQrString).'
      });
    }

    const qrisGen = new QRISGenerator(config, 'theme1');
    const reference = 'REF' + Date.now();
    const qrString = qrisGen.generateQrString(amount);

    return res.status(200).json({
      success: true,
      reference,
      amount,
      qrString
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + (err && err.message ? err.message : 'Unknown error')
    });
  }
};