// api/check-payment.js

module.exports = async (req, res) => {
  // Hanya izinkan GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan GET.'
    });
  }

  let PaymentChecker;

  // Coba load autoft-qris secara aman
  try {
    const mod = require('autoft-qris');

    // Coba beberapa kemungkinan bentuk export
    PaymentChecker =
      mod.PaymentChecker ||
      (mod.default && mod.default.PaymentChecker) ||
      mod; // kalau dia export langsung kelasnya

    if (typeof PaymentChecker !== 'function') {
      throw new Error(
        'PaymentChecker bukan function. Cek versi autoft-qris atau bentuk export-nya.'
      );
    }
  } catch (err) {
    console.error('Gagal require autoft-qris / PaymentChecker:', err);
    return res.status(500).json({
      success: false,
      message:
        'Server gagal load PaymentChecker dari autoft-qris: ' + err.message
    });
  }

  try {
    const { reference, amount } = req.query;

    if (!reference || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Parameter reference dan amount wajib diisi.'
      });
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount tidak valid.'
      });
    }

    const auth_username = process.env.ORKUT_AUTH_USERNAME;
    const auth_token = process.env.ORKUT_AUTH_TOKEN;

    if (!auth_username || !auth_token) {
      return res.status(500).json({
        success: false,
        message:
          'Env ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum diset di Project Settings Vercel.'
      });
    }

    // Bener-bener sama pola-nya kayak README
    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    const result = await checker.checkPaymentStatus(reference, numericAmount);

    // Kalau lib sudah balikin { success, data, message }
    if (result && typeof result === 'object' && 'success' in result) {
      return res.status(result.success ? 200 : 400).json(result);
    }

    // Fallback kalau bentuknya beda
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error di handler /api/check-payment:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + err.message
    });
  }
};    });
  } catch (err) {
    console.error('Error di /api/check-payment:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + err.message
    });
  }
};
