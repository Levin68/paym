// api/check-payment.js

require('dotenv').config();

function resolvePaymentChecker() {
  // Di sini kita coba ambil PaymentChecker dari berbagai bentuk export
  const mod = require('autoft-qris'); // pastikan package sudah ke-install

  let PaymentChecker =
    mod.PaymentChecker ||
    (mod.default && mod.default.PaymentChecker) ||
    mod.default ||
    mod;

  if (typeof PaymentChecker !== 'function') {
    throw new Error('PaymentChecker tidak ditemukan di export autoft-qris');
  }

  return PaymentChecker;
}

module.exports = async (req, res) => {
  // HANYA izinkan GET, karena frontend pakai GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan GET.'
    });
  }

  const { reference, amount } = req.query;

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Parameter reference dan amount wajib diisi.'
    });
  }

  try {
    // 1. Ambil kredensial dari ENV
    const auth_username = process.env.ORKUT_AUTH_USERNAME;
    const auth_token = process.env.ORKUT_AUTH_TOKEN;

    if (!auth_username || !auth_token) {
      return res.status(500).json({
        success: false,
        message:
          'Env ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum diset di Vercel.'
      });
    }

    // 2. Load PaymentChecker dari autoft-qris (semua error di-catch)
    let PaymentChecker;
    try {
      PaymentChecker = resolvePaymentChecker();
    } catch (err) {
      console.error('Gagal load PaymentChecker:', err);
      return res.status(500).json({
        success: false,
        message: `Server gagal load PaymentChecker dari autoft-qris: ${err.message}`
      });
    }

    // 3. Buat instance dan cek status
    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount tidak valid.'
      });
    }

    const result = await checker.checkPaymentStatus(reference, numericAmount);

    // Library autoft-qris udah balikin bentuk { success, data, message }
    // Kita forward aja ke frontend
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error di /api/check-payment:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error saat cek pembayaran.'
    });
  }
};  }

  if (typeof PaymentChecker !== 'function') {
    console.error('[check-payment] PaymentChecker bukan function/class:', PaymentChecker);
    return res.status(500).json({
      success: false,
      message: 'PaymentChecker dari autoft-qris tidak ditemukan.'
    });
  }

  try {
    const checker = new PaymentChecker({
      auth_token: ORKUT_AUTH_TOKEN,
      auth_username: ORKUT_AUTH_USERNAME
    });

    const result = await checker.checkPaymentStatus(
      reference,
      Number(amount)
    );

    console.log('[check-payment] result:', result);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[check-payment] error saat checkPaymentStatus:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal cek status pembayaran: ' + err.message
    });
  }
};
