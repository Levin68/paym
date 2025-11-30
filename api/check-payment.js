// api/check-payment.js

module.exports = async function handler(req, res) {
  // Hanya boleh GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET.'
    });
  }

  // Ambil query dari URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const reference = url.searchParams.get('reference');
  const amountParam = url.searchParams.get('amount');

  const amount = Number(amountParam);

  if (!reference || !amount || Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Param reference / amount tidak valid.'
    });
  }

  // --- LOAD PaymentChecker dengan aman (ESM support) ---
  let PaymentChecker;
  try {
    const autoft = await import('autoft-qris');

    // coba beberapa kemungkinan export
    PaymentChecker =
      autoft.PaymentChecker ||
      (autoft.default && autoft.default.PaymentChecker);

    if (!PaymentChecker) {
      throw new Error(
        'Export PaymentChecker tidak ditemukan di autoft-qris. Pastikan versi package sudah yang terbaru (>= 0.0.9).'
      );
    }
  } catch (err) {
    console.error('ERR_LOAD_PAYMENTCHECKER', err);
    return res.status(500).json({
      success: false,
      message:
        'Server gagal load PaymentChecker dari autoft-qris: ' + err.message
    });
  }

  // --- PANGGIL API OrderKuota lewat PaymentChecker ---
  try {
    const checker = new PaymentChecker({
      auth_token: process.env.ORKUT_AUTH_TOKEN,
      auth_username: process.env.ORKUT_AUTH_USERNAME
    });

    const result = await checker.checkPaymentStatus(reference, amount);

    // result biasanya bentuknya { success, data: { status: 'PAID' / ... } }
    return res.status(200).json({
      success: true,
      data: result.data || result
    });
  } catch (err) {
    console.error('ERR_CHECK_PAYMENT', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal cek status ke OrderKuota: ' + err.message
    });
  }
};    const result = await checker.checkPaymentStatus(reference || null, amt);

    // library biasanya balikin { success, data: { status, ... } }
    const status =
      (result &&
        (result.data?.status || result.data?.payment_status || result.status)) ||
      'UNKNOWN';

    return res.status(200).json({
      success: true,
      data: {
        status,
        raw: result
      }
    });
  } catch (err) {
    console.error('Error di /api/check-payment:', err);
    return res.status(500).json({
      success: false,
      message: `Server gagal cek pembayaran: ${err.message}`
    });
  }
};
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
