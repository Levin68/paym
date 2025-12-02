module.exports = async (req, res) => {
  console.log("Received request for /pay-status");

  let reference = req.query.reference || req.body.reference;
  let amount = req.query.amount || req.body.amount;

  console.log("Parameters received:", { reference, amount });

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Reference dan Amount wajib diisi',
    });
  }

  try {
    console.log("Initializing PaymentChecker...");
    const checker = new PaymentChecker({
      auth_token: process.env.ORKUT_AUTH_TOKEN,
      auth_username: process.env.ORKUT_AUTH_USERNAME
    });

    console.log("PaymentChecker initialized.");

    const timeout = 5 * 60 * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await checker.checkPaymentStatus(reference, amount);
      const norm = normalizeResult(result);

      if (norm.status === 'PAID') {
        console.log("Payment detected as PAID.");
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
