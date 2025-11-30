// api/check-payment.js

module.exports = async (req, res) => {
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

  // ambil kredensial dari ENV Vercel
  const { ORKUT_AUTH_USERNAME, ORKUT_AUTH_TOKEN } = process.env;

  if (!ORKUT_AUTH_USERNAME || !ORKUT_AUTH_TOKEN) {
    return res.status(500).json({
      success: false,
      message: 'ENV ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum diset.'
    });
  }

  let PaymentChecker;

  try {
    // PENTING: pakai dynamic import supaya modul ESM bisa ke-load
    const mod = await import('autoft-qris');

    PaymentChecker =
      mod.PaymentChecker ||
      (mod.default && mod.default.PaymentChecker);

    if (!PaymentChecker) {
      throw new Error('Export PaymentChecker tidak ditemukan di autoft-qris');
    }
  } catch (err) {
    console.error('Err load PaymentChecker:', err);
    return res.status(500).json({
      success: false,
      message:
        'Server gagal load PaymentChecker dari autoft-qris: ' + err.message
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

    // langsung lempar response dari library ke FE
    return res.status(200).json(result);
  } catch (err) {
    console.error('Err checkPaymentStatus:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal cek status pembayaran: ' + err.message
    });
  }
};      success: false,
      message:
        err.message || 'Terjadi kesalahan di server saat cek pembayaran.'
    });
  }
};
