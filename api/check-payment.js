// api/check-payment.js
// Cek status pembayaran pakai PaymentChecker dari autoft-qris

module.exports = async (req, res) => {
  // Hanya GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET.'
    });
  }

  const { reference, amount } = req.query || {};
  const amt = Number(amount);

  if (!reference || !amt || amt <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Parameter reference / amount tidak valid.'
    });
  }

  let PaymentChecker;
  try {
    const mod = await import('autoft-qris');
    PaymentChecker =
      mod.PaymentChecker || (mod.default && mod.default.PaymentChecker);
  } catch (e) {
    console.error('Gagal import autoft-qris PaymentChecker:', e);
    return res.status(500).json({
      success: false,
      message:
        'Server gagal load PaymentChecker dari autoft-qris: ' + e.message
    });
  }

  if (!PaymentChecker) {
    return res.status(500).json({
      success: false,
      message:
        'PaymentChecker tidak ditemukan di autoft-qris. Pastikan versi package 0.0.9 dan kompatibel.'
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

  try {
    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    const result = await checker.checkPaymentStatus(reference, amt);
    // Biasanya: { success, data: { status }, message? }
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
