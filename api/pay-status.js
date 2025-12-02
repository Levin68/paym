const { PaymentChecker } = require('autoft-qris'); // Pastikan untuk mengimpor modul PaymentChecker
const config = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
};

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan POST.',
    });
  }

  let reference = req.query.reference || req.body.reference;
  let amount = req.query.amount || req.body.amount;

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Reference dan Amount wajib diisi',
    });
  }

  try {
    // Cek apakah credentials ada
    if (!config.auth_username || !config.auth_token) {
      return res.status(500).json({
        success: false,
        message: 'ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set di ENV',
      });
    }

    // Inisialisasi PaymentChecker
    const checker = new PaymentChecker({
      auth_token: config.auth_token,
      auth_username: config.auth_username,
    });

    // Tentukan batas waktu untuk timeout
    const timeout = 5 * 60 * 1000; // Timeout 5 menit
    const startTime = Date.now();

    // Polling untuk status pembayaran setiap 3 detik
    while (Date.now() - startTime < timeout) {
      const result = await checker.checkPaymentStatus(reference, amount);
      const norm = normalizeResult(result);

      // Jika status pembayaran sudah PAID, kirimkan respons sukses
      if (norm.status === 'PAID') {
        return res.status(200).json({
          success: true,
          reference,
          status: norm.status,
          amount,
          raw: norm.raw,
        });
      }

      // Jika status belum PAID, tunggu 3 detik sebelum pengecekan lagi
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Jika timeout tercapai, kembalikan status timeout
    return res.status(408).json({
      success: false,
      message: 'Pembayaran tidak terdeteksi dalam waktu 5 menit',
    });
  } catch (err) {
    console.error('[pay-status] ERROR:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  }
};

// Fungsi untuk normalisasi status
function normalizeResult(res) {
  if (!res || typeof res !== 'object') {
    return { status: 'UNKNOWN', raw: res };
  }

  let data = res.data || res.result || res;
  if (Array.isArray(data)) data = data[0] || {};

  const statusRaw = (data.status || data.payment_status || data.transaction_status || '').toString();
  const status = statusRaw ? statusRaw.toUpperCase() : 'UNKNOWN';

  return {
    status,
    raw: res,
  };
}
