// api/check-payment.js

// Helper: cache supaya modul nggak di-import berkali-kali
let cachedPaymentChecker = null;

async function getPaymentChecker() {
  if (cachedPaymentChecker) return cachedPaymentChecker;

  try {
    // autoft-qris itu dual module (ESM + CJS), jadi pakai dynamic import
    const mod = await import('autoft-qris');

    const PaymentChecker =
      mod.PaymentChecker ||
      (mod.default && mod.default.PaymentChecker) ||
      null;

    if (!PaymentChecker) {
      console.error(
        '[check-payment] PaymentChecker tidak ditemukan di autoft-qris export'
      );
      return null;
    }

    cachedPaymentChecker = PaymentChecker;
    return PaymentChecker;
  } catch (err) {
    console.error('[check-payment] Gagal import autoft-qris:', err);
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    // --- Cek method ---
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed. Gunakan GET.'
      });
    }

    // --- Ambil query ---
    const { reference, amount } = req.query;

    if (!reference || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Query "reference" dan "amount" wajib diisi.'
      });
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount tidak valid.'
      });
    }

    // --- Load PaymentChecker dari autoft-qris ---
    const PaymentChecker = await getPaymentChecker();
    if (!PaymentChecker) {
      // DI SINI kalau ada masalah library, dia BALIK JSON, bukan crash
      return res.status(500).json({
        success: false,
        message:
          'Server gagal load PaymentChecker dari autoft-qris. Coba beberapa saat lagi atau hubungi admin.'
      });
    }

    // --- Cek env ---
    const authToken = process.env.ORKUT_AUTH_TOKEN;
    const authUsername = process.env.ORKUT_AUTH_USERNAME;

    if (!authToken || !authUsername) {
      console.error('[check-payment] ENV belum lengkap');
      return res.status(500).json({
        success: false,
        message:
          'Konfigurasi server belum lengkap (auth token / username). Hubungi admin.'
      });
    }

    // --- Panggil PaymentChecker ---
    const checker = new PaymentChecker({
      auth_token: authToken,
      auth_username: authUsername
    });

    const result = await checker.checkPaymentStatus(reference, numericAmount);

    // Struktur result dari library:
    // { success: true/false, data: { status: 'PAID' | 'UNPAID' | ... , ... } }
    if (!result || result.success === false) {
      return res.status(200).json({
        success: false,
        message:
          (result && result.message) ||
          'Gagal cek status pembayaran dari OrderKuota.',
        data: result && result.data ? result.data : null
      });
    }

    // Sukses
    return res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    console.error('[check-payment] ERROR TIDAK TERDUGA:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi error di server saat cek pembayaran.'
    });
  }
};    console.error('ERR_CHECK_PAYMENT', err);
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
