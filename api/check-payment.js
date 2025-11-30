// api/check-payment.js

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.'
    });
  }

  // 1) Coba load PaymentChecker di dalam handler
  let PaymentChecker;
  try {
    ({ PaymentChecker } = require('autoft-qris'));
  } catch (err) {
    console.error('Gagal load autoft-qris (PaymentChecker):', err);
    return res.status(500).json({
      success: false,
      message: 'Server gagal load library autoft-qris (PaymentChecker): ' + (err.message || String(err))
    });
  }

  try {
    const body = req.body || {};
    const { reference, amount } = body;

    if (!reference || !amount) {
      return res.status(400).json({
        success: false,
        message: 'reference dan amount wajib diisi'
      });
    }

    const checker = new PaymentChecker({
      auth_token: process.env.ORKUT_AUTH_TOKEN,
      auth_username: process.env.ORKUT_AUTH_USERNAME
    });

    const result = await checker.checkPaymentStatus(reference, Number(amount));

    return res.status(200).json(result);
  } catch (err) {
    console.error('check-payment error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + (err && err.message ? err.message : 'Unknown error')
    });
  }
};