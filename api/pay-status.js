// api/pay-status.js

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  // 1) require di dalam handler, pakai try..catch
  let PaymentChecker;
  try {
    ({ PaymentChecker } = require('autoft-qris'));
  } catch (e) {
    console.error('ERROR require autoft-qris (pay-status):', e);
    return res.status(500).json({
      success: false,
      stage: 'require-autoft-qris',
      message: e.message,
      stack: e.stack
    });
  }

  try {
    const { ref, amount } = req.query;

    if (!ref) {
      return res
        .status(400)
        .json({ success: false, message: 'ref wajib diisi' });
    }

    const checker = new PaymentChecker({
      auth_token: process.env.ORKUT_AUTH_TOKEN,
      auth_username: process.env.ORKUT_AUTH_USERNAME
    });

    const nominal = amount ? Number(amount) : undefined;
    const result = await checker.checkPaymentStatus(ref, nominal);

    return res.status(200).json(result);
  } catch (err) {
    console.error('pay-status error:', err);
    return res.status(500).json({
      success: false,
      stage: 'handler',
      message: err.message || 'Internal server error',
      stack: err.stack
    });
  }
};
