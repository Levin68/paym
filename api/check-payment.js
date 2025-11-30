// api/check-payment.js

module.exports = async (req, res) => {
  // 1. Hanya izinkan GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan GET.'
    });
  }

  // 2. Ambil query string
  const { reference, amount } = req.query;

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Parameter reference dan amount wajib diisi.'
    });
  }

  // 3. Ambil kredensial dari ENV Vercel (TANPA dotenv)
  const auth_username = process.env.ORKUT_AUTH_USERNAME;
  const auth_token = process.env.ORKUT_AUTH_TOKEN;

  if (!auth_username || !auth_token) {
    return res.status(500).json({
      success: false,
      message:
        'Env ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum diset di Project Settings Vercel.'
    });
  }

  try {
    // 4. Require autoft-qris DI DALAM try/catch
    let mod;
    try {
      mod = require('autoft-qris');
    } catch (err) {
      console.error('Require autoft-qris error:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal require autoft-qris: ' + err.message
      });
    }

    // 5. Coba resolve PaymentChecker dari berbagai bentuk export
    let PaymentChecker =
      mod.PaymentChecker ||
      (mod.default && mod.default.PaymentChecker) ||
      mod.default;

    if (typeof PaymentChecker !== 'function') {
      console.error('Bentuk export autoft-qris:', Object.keys(mod));
      if (mod.default && typeof mod.default === 'object') {
        console.error('Bentuk export default:', Object.keys(mod.default));
      }

      return res.status(500).json({
        success: false,
        message: 'PaymentChecker tidak ditemukan di export autoft-qris.'
      });
    }

    // 6. Buat instance dan cek status
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

    // 7. Forward hasil dari library ke frontend
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error tak terduga di /api/check-payment:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error saat cek pembayaran: ' + err.message
    });
  }
};    // 3. Buat instance dan cek status
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
