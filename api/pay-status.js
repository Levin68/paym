const { PaymentChecker } = require('autoft-qris'); // Pastikan ini diimpor dengan benar

// Tambahkan error handling di sekitar checker
const checker = new PaymentChecker({
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  auth_username: process.env.ORKUT_AUTH_USERNAME
});

try {
  const result = await checker.checkPaymentStatus(reference, amount);
  const norm = normalizeResult(result);

  // Kode lainnya
} catch (e) {
  console.error('Error checking payment status:', e);
  return res.status(500).json({
    success: false,
    message: 'Gagal memeriksa status pembayaran',
    error: e.message
  });
}
