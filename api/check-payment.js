// api/check-payment.js

// PAKAI CJS BIASA (SAMA KAYA create-qris.js)
let PaymentChecker;

try {
  // autoft-qris versi terbaru sudah expose PaymentChecker di sini
  const lib = require('autoft-qris');
  PaymentChecker = lib.PaymentChecker;
} catch (err) {
  console.error('Gagal require autoft-qris untuk PaymentChecker:', err);
}

// ambil kredensial dari ENV Vercel
const AUTH_USERNAME = process.env.ORKUT_AUTH_USERNAME;
const AUTH_TOKEN = process.env.ORKUT_AUTH_TOKEN;

let checkerInstance = null;

function getPaymentChecker() {
  if (!PaymentChecker) {
    throw new Error(
      'PaymentChecker tidak tersedia dari autoft-qris. Cek versi package / dependency.'
    );
  }

  if (!AUTH_USERNAME || !AUTH_TOKEN) {
    throw new Error(
      'ENV ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set di Vercel.'
    );
  }

  if (!checkerInstance) {
    checkerInstance = new PaymentChecker({
      auth_token: AUTH_TOKEN,
      auth_username: AUTH_USERNAME
    });
  }

  return checkerInstance;
}

module.exports = async (req, res) => {
  // kita pakai GET dari frontend
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed. Use GET.' });
  }

  try {
    const { reference, amount } = req.query;
    const amt = parseInt(amount, 10);

    if (!amt || amt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount query tidak valid'
      });
    }

    const checker = getPaymentChecker();

    // sesuai contoh di README, reference sebenernya nggak wajib dipakai
    const result = await checker.checkPaymentStatus(reference || null, amt);

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
