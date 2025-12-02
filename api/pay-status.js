let paymentCheckerPromise = null;

async function getPaymentChecker() {
  if (paymentCheckerPromise) return paymentCheckerPromise;

  paymentCheckerPromise = (async () => {
    try {
      // Load modul autoft-qris dan pastikan PaymentChecker berhasil di-load
      try {
        console.log("Trying to load autoft-qris/src/payment-checker.mjs...");
        const m1 = await import('autoft-qris/src/payment-checker.mjs');
        const C1 = m1.PaymentChecker || m1.default || m1;
        console.log("Loaded autoft-qris/src/payment-checker.mjs:", C1);
        if (C1) return C1;
      } catch (e1) {
        console.error("Error loading autoft-qris/src/payment-checker.mjs:", e1);
        throw new Error('Error loading payment checker module');
      }

      // Fallback check (if needed)
      throw new Error('PaymentChecker tidak ditemukan');
    } catch (e) {
      console.error("Error loading payment checker:", e);
      throw e;
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
    const status = await paymentChecker.check(reference); // Misalnya, cek status menggunakan reference

    // Menentukan status berdasarkan hasil pengecekan
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
