// api/check-payment.js
// Node 20 di Vercel sudah punya fetch built-in, jadi nggak perlu node-fetch.

// TODO: ganti ini pakai URL endpoint cek pembayaran dari OrderKuota
// minta ke @AutoFtBot69 / dokumentasi mereka.
const ORDERKUOTA_CHECK_URL = process.env.ORKUT_CHECK_URL || 'https://example.com/orderkuota/check-payment';

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
      message: 'Param reference & amount wajib diisi.'
    });
  }

  try {
    // kredensial dari ENV (sama seperti create-qris)
    const authUsername = process.env.ORKUT_AUTH_USERNAME;
    const authToken = process.env.ORKUT_AUTH_TOKEN;

    if (!authUsername || !authToken) {
      return res.status(500).json({
        success: false,
        message: 'ENV ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set di Vercel.'
      });
    }

    // ====== CONTOH REQUEST KE ORDERKUOTA ======
    // Bentuk ini cuma contoh. Samakan dengan dokumen resmi API OrderKuota.
    const upstreamRes = await fetch(ORDERKUOTA_CHECK_URL, {
      method: 'POST',                     // kalau API mereka pakai GET, ubah di sini
      headers: {
        'Content-Type': 'application/json',
        'x-auth-username': authUsername,  // atau header lain sesuai dokumentasi
        'x-auth-token': authToken
      },
      body: JSON.stringify({
        reference,
        amount: Number(amount)
      })
    });

    const rawText = await upstreamRes.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      // Respon bukan JSON (misal: 404 HTML, atau text "BAD REQUEST")
      return res.status(502).json({
        success: false,
        message:
          'Respon OrderKuota bukan JSON. Cuplikan: ' +
          rawText.slice(0, 200)
      });
    }

    // ====== MAPPING RESPONSE ======
    // Anggap API balikin { success:true, data:{ status:'PAID'|'UNPAID'|... } }
    // Kalau format aslinya beda, mapping aja di sini.
    if (!upstreamRes.ok || data.success === false) {
      return res.status(200).json({
        success: false,
        message: data.message || 'Gagal cek pembayaran di OrderKuota',
        data: data.data || null
      });
    }

    // pastikan ada field status
    const status = data.data?.status || 'UNKNOWN';

    return res.status(200).json({
      success: true,
      data: {
        status,
        raw: data.data || data
      }
    });
  } catch (err) {
    console.error('Error check-payment:', err);
    return res.status(500).json({
      success: false,
      message: `Server error saat cek pembayaran: ${err.message}`
    });
  }
};      return res.status(500).json({
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
