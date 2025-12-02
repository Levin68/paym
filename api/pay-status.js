let paymentCheckerPromise = null;

async function getPaymentChecker() {
  if (paymentCheckerPromise) return paymentCheckerPromise;

  paymentCheckerPromise = (async () => {
    try {
      console.log("Attempting to load payment checker...");
      const m1 = await import('autoft-qris/src/payment-checker.mjs');
      const PaymentChecker = m1.PaymentChecker || m1.default;

      if (!PaymentChecker) {
        throw new Error('PaymentChecker tidak ditemukan dalam module autoft-qris');
      }

      console.log("PaymentChecker berhasil dimuat.");
      return new PaymentChecker();  // Instantiate PaymentChecker
    } catch (error) {
      console.error('Gagal memuat PaymentChecker:', error);
      throw error;
    }
  })();

  return paymentCheckerPromise;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan POST.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { reference, amount } = body;

    if (!reference || !amount || typeof reference !== 'string' || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Parameter reference atau amount tidak valid.',
      });
    }

    const paymentChecker = await getPaymentChecker();

    // Check payment status, use correct method of paymentChecker
    const status = await paymentChecker.checkPaymentStatus(reference); // Pastikan checkPaymentStatus ada

    let resultStatus = 'UNKNOWN';
    let errorDetail = '';

    if (status.success) {
      resultStatus = 'SUCCESS';
    } else {
      resultStatus = 'FAILED';
      errorDetail = status.error || 'Unknown error';
    }

    return res.status(200).json({
      success: true,
      reference,
      amount,
      status: resultStatus,
      raw: {
        success: status.success,
        error: errorDetail,
      },
    });
  } catch (error) {
    console.error('Error handling payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses status pembayaran',
      error: error.message,
    });
  }
};
