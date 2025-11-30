// api/check-payment.js

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET.'
    });
  }

  // 1) Load PaymentChecker via dynamic import (ESM)
  let PaymentChecker;
  try {
    const mod = await import('autoft-qris');
    PaymentChecker = mod.PaymentChecker;
  } catch (err) {
    console.error('Gagal load autoft-qris (PaymentChecker):', err);
    return res.status(500).json({
      success: false,
      message:
        'Server gagal load library autoft-qris (PaymentChecker): ' +
        (err && err.message ? err.message : String(err))
    });
  }

  try {
    const { reference, amount } = req.query || {};

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

    // result dari autoft-qris sudah bentuk { success, data: { status, ... } }
    return res.status(200).json(result);
  } catch (err) {
    console.error('check-payment error:', err);
    return res.status(500).json({
      success: false,
      message:
        'Server error: ' + (err && err.message ? err.message : 'Unknown error')
    });
  }
};