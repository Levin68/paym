// api/check-payment.js
// Cek status pembayaran ke OrderKuota lewat autoft-qris

const { PaymentChecker } = require('autoft-qris');

module.exports = async (req, res) => {
  // Hanya izinkan GET
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed. Use GET.' });
  }

  try {
    const { reference, amount } = req.query || {};
    const amt = Number(amount);

    if (!reference || !amt || amt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameter reference / amount tidak valid.'
      });
    }

    // Pastikan ENV sudah di-set di Vercel
    const auth_username = process.env.ORKUT_AUTH_USERNAME;
    const auth_token = process.env.ORKUT_AUTH_TOKEN;

    if (!auth_username || !auth_token) {
      return res.status(500).json({
        success: false,
        message:
          'ENV belum lengkap. Set ORKUT_AUTH_USERNAME & ORKUT_AUTH_TOKEN di Vercel.'
      });
    }

    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    // autoft-qris sudah balikin { success, data, message }
    const result = await checker.checkPaymentStatus(reference, amt);

    // langsung terusin ke frontend
    return res.status(200).json(result);
  } catch (err) {
    console.error('check-payment error', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Terjadi kesalahan di server saat cek pembayaran.'
    });
  }
};
