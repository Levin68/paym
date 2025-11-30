// api/check-payment.js

let PaymentChecker;

try {
  // ambil dari CJS build yang sama seperti QRISGenerator
  ({ PaymentChecker } = require('autoft-qris/dist/cjs/autoft-qris.cjs'));
} catch (err) {
  console.error('Gagal load PaymentChecker dari autoft-qris:', err);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed. Use GET.' });
  }

  if (!PaymentChecker) {
    return res.status(500).json({
      success: false,
      message: 'Server gagal load PaymentChecker dari autoft-qris.'
    });
  }

  const { reference, amount } = req.query;

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'reference dan amount wajib diisi.'
    });
  }

  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'amount tidak valid.'
    });
  }

  const checker = new PaymentChecker({
    auth_token: process.env.ORKUT_AUTH_TOKEN,
    auth_username: process.env.ORKUT_AUTH_USERNAME
  });

  try {
    const result = await checker.checkPaymentStatus(reference, numericAmount);

    return res.status(200).json({
      success: true,
      data: result.data || result
    });
  } catch (err) {
    console.error('check-payment error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal cek status pembayaran.'
    });
  }
};  } catch (err) {
    console.error('check-payment error:', err);
    return res.status(500).json({
      success: false,
      message:
        err.message || 'Terjadi kesalahan di server saat cek pembayaran.'
    });
  }
};
