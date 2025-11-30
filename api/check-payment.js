// api/check-payment.js
// Cek status pembayaran pakai PaymentChecker dari autoft-qris (REAL, bukan dummy)

const { PaymentChecker } = require('autoft-qris'); // sesuai README: CJS export

module.exports = async (req, res) => {
  // hanya ijinkan GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET.'
    });
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

    const auth_username = process.env.ORKUT_AUTH_USERNAME;
    const auth_token = process.env.ORKUT_AUTH_TOKEN;

    if (!auth_username || !auth_token) {
      return res.status(500).json({
        success: false,
        message:
          'ENV belum lengkap. Set ORKUT_AUTH_USERNAME & ORKUT_AUTH_TOKEN di Vercel.'
      });
    }

    // sama persis seperti contoh README
    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    const result = await checker.checkPaymentStatus(reference, amt);
    // result biasanya: { success, data: { status: 'PAID'|'UNPAID'|... }, message? }

    // teruskan apa adanya ke frontend
    return res.status(200).json(result);
  } catch (err) {
    console.error('check-payment error:', err);
    return res.status(500).json({
      success: false,
      message:
        err.message || 'Terjadi kesalahan di server saat cek pembayaran.'
    });
  }
};
