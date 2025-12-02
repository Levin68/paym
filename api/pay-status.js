module.exports = async (req, res) => {
  let reference = req.query.reference || req.body.reference;
  let amount = req.query.amount || req.body.amount;

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Reference dan Amount wajib diisi',
    });
  }

  try {
    // Cek apakah PaymentChecker berhasil diinisialisasi
    console.log("Initializing PaymentChecker...");
    const checker = new PaymentChecker({
      auth_token: process.env.ORKUT_AUTH_TOKEN,
      auth_username: process.env.ORKUT_AUTH_USERNAME
    });

    const timeout = 5 * 60 * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Panggil checkPaymentStatus
      const result = await checker.checkPaymentStatus(reference, amount);
      console.log("Result from PaymentChecker:", result);

      // Cek jika result tidak undefined dan memiliki data yang benar
      if (!result || typeof result !== 'object') {
        console.error("Invalid response from PaymentChecker:", result);
        return res.status(500).json({
          success: false,
          message: 'Invalid response from PaymentChecker',
        });
      }

      // Normalisasi hasil jika data ada
      const norm = normalizeResult(result);

      if (norm && norm.status === 'PAID') {
        return res.status(200).json({
          success: true,
          reference,
          status: norm.status,
          amount,
          raw: norm.raw,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 3000)); // Check every 3 seconds
    }

    return res.status(408).json({
      success: false,
      message: 'Pembayaran tidak terdeteksi dalam waktu 5 menit',
    });

  } catch (err) {
    console.error("Error occurred while checking payment status:", err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  }
};

// Normalisasi result untuk memastikan data selalu ada
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
