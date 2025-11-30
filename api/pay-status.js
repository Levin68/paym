const { PaymentChecker } = require('autoft-qris');

const checker = new PaymentChecker({
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  auth_username: process.env.ORKUT_AUTH_USERNAME
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { ref, amount } = req.query;

    if (!ref) {
      return res
        .status(400)
        .json({ success: false, message: 'ref wajib diisi' });
    }

    const nominal = amount ? Number(amount) : undefined;
    const result = await checker.checkPaymentStatus(ref, nominal);

    return res.status(200).json(result);
  } catch (err) {
    console.error('pay-status error:', err);
    return res
      .status(500)
      .json({ success: false, message: err.message || 'Internal server error' });
  }
};
