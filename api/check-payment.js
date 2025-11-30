// api/check-payment.js
// Cek status pembayaran ke OrderKuota lewat autoft-qris (pakai require biasa)

let PaymentChecker = null;
let loadError = null;

try {
  // Sama kayak README: ambil dari root package
  const mod = require('autoft-qris');
  // Coba baca dari named export atau dari default (kalau CJS bungkus)
  PaymentChecker = mod.PaymentChecker || (mod.default && mod.default.PaymentChecker);
} catch (e) {
  loadError = e;
  console.error('Gagal load PaymentChecker dari autoft-qris:', e);
}

module.exports = async (req, res) => {
  // Hanya izinkan GET
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed. Use GET.' });
  }

  // Kalau gagal load library, jangan crash, balas JSON
  if (!PaymentChecker) {
    return res.status(500).json({
      success: false,
      message:
        'Server gagal load PaymentChecker dari autoft-qris: ' +
        (loadError ? loadError.message : 'unknown error')
    });
  }

  try {
    const { reference, amount } = req.query || {};
    const amt = Number(amount);

    // Kalau kamu buka /api/check-payment tanpa param, masuk ke sini
    if (!reference || !amt || amt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameter reference / amount tidak valid.'
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

    const checker = new PaymentChecker({
      auth_token,
      auth_username
    });

    // autoft-qris biasanya balikin: { success, data: { status, ... }, message? }
    const result = await checker.checkPaymentStatus(reference, amt);

    // Terusin apa adanya ke frontend
    return res.status(200).json(result);
  } catch (err) {
    console.error('check-payment error', err);
    return res.status(500).json({
      success: false,
      message:
        err.message || 'Terjadi kesalahan di server saat cek pembayaran.'
    });
  }
};    });

    // autoft-qris biasanya balikin: { success, data: { status, ... }, message? }
    const result = await checker.checkPaymentStatus(reference, amt);

    // Terusin apa adanya ke frontend
    return res.status(200).json(result);
  } catch (err) {
    console.error('check-payment error', err);
    return res.status(500).json({
      success: false,
      message:
        err.message || 'Terjadi kesalahan di server saat cek pembayaran.'
    });
  }
};    // Terusin apa adanya ke frontend
    return res.status(200).json(result);
  } catch (err) {
    console.error('check-payment error', err);
    return res.status(500).json({
      success: false,
      message:
        err.message || 'Terjadi kesalahan di server saat cek pembayaran.'
    });
  }
};
