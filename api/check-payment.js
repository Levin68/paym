// api/check-payment.js

// PENTING: butuh dependency ini di package.json:
// "autoft-qris": "^0.0.9"
const { PaymentChecker } = require('autoft-qris');

module.exports = async (req, res) => {
  // Hanya izinkan GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan GET.'
    });
  }

  try {
    const { reference, amount } = req.query;

    // Validasi query
    if (!reference || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Parameter reference dan amount wajib diisi.'
      });
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount tidak valid.'
      });
    }

    // Ambil kredensial dari ENV Vercel
    const auth_username = process.env.ORKUT_AUTH_USERNAME;
    const auth_token = process.env.ORKUT_AUTH_TOKEN;

    if (!auth_username || !auth_token) {
      return res.status(500).json({
        success: false,
        message:
          'Env ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum diset di Project Settings Vercel.'
      });
    }

    // Instance PaymentChecker sesuai README
    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    // Call ke OrderKuota lewat autoft-qris
    const result = await checker.checkPaymentStatus(reference, numericAmount);

    // Kalau library sudah balikin { success, data, message }
    if (result && typeof result === 'object' && 'success' in result) {
      return res.status(result.success ? 200 : 400).json(result);
    }

    // Fallback kalau bentuk result beda
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error di /api/check-payment:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + err.message
    });
  }
};
