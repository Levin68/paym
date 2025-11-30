// api/check-payment.js
const { PaymentChecker } = require('autoft-qris');

const paymentChecker = new PaymentChecker({
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  auth_username: process.env.ORKUT_AUTH_USERNAME
});

module.exports = async (req, res) => {
  const { reference, amount } = req.query || {};

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'reference / amount tidak boleh kosong'
    });
  }

  try {
    const result = await paymentChecker.checkPaymentStatus(
      reference,
      Number(amount)
    );

    // result: { success, data: { status: 'PAID'|'UNPAID'|... } }
    return res.status(200).json(result);
  } catch (err) {
    console.error('check-payment error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal cek status pembayaran'
    });
  }
};