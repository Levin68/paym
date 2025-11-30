// api/pay-status.js

let PaymentCheckerClass = null;

async function getPaymentChecker() {
  if (!PaymentCheckerClass) {
    const m = await import('autoft-qris/src/payment-checker.mjs');
    PaymentCheckerClass = m.default || m.PaymentChecker;
  }
  return new PaymentCheckerClass({
    auth_token: process.env.ORKUT_AUTH_TOKEN,
    auth_username: process.env.ORKUT_AUTH_USERNAME
  });
}

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

    const checker = await getPaymentChecker();
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
