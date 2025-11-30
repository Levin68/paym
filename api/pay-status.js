// api/pay-status.js

const { PaymentChecker } = require('autoft-qris');

const config = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN
};

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res
        .status(405)
        .json({ success: false, message: 'Method not allowed. Use GET.' });
    }

    const { reference, amount } = req.query || {};
    const amt = Number(amount);

    if (!reference || !amt || !Number.isFinite(amt)) {
      return res.status(400).json({
        success: false,
        message: 'Param reference atau amount tidak valid.'
      });
    }

    if (!config.auth_username || !config.auth_token) {
      return res.status(500).json({
        success: false,
        message:
          'Env ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum diset di Vercel.'
      });
    }

    const checker = new PaymentChecker({
      auth_token: config.auth_token,
      auth_username: config.auth_username
    });

    const result = await checker.checkPaymentStatus(reference, amt);

    if (!result || result.success === false) {
      return res.status(200).json({
        success: false,
        message: (result && result.message) || 'Gagal cek pembayaran dari API.'
      });
    }

    const data = result.data || result.result || result;
    const status = (data.status || data.payment_status || '').toUpperCase();

    return res.status(200).json({
      success: true,
      data: {
        status,
        raw: data
      }
    });
  } catch (err) {
    console.error('pay-status error:', err);
    return res.status(500).json({
      success: false,
      message:
        'Server error di pay-status: ' + (err && err.message ? err.message : String(err))
    });
  }
};
