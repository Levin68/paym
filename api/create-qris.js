// api/create-qris.js

const { QRISGenerator } = require('autoft-qris');

const config = {
  storeName: process.env.STORE_NAME || 'LevPay',
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
  baseQrString: (process.env.BASE_QR_STRING || '').trim(),
  logoPath: null
};

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res
        .status(405)
        .json({ success: false, message: 'Method not allowed. Use POST.' });
    }

    const { amount } = req.body || {};
    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Nominal tidak valid.' });
    }

    if (!config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: 'BASE_QR_STRING belum diset di Environment Vercel.'
      });
    }

    // generator dari autoft-qris
    const qrisGen = new QRISGenerator(config, 'theme1');

    const reference = 'REF' + Date.now();
    const qrString = qrisGen.generateQrString(amt);

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount: amt,
        qrString
      }
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      message:
        'Server error di create-qris: ' + (err && err.message ? err.message : String(err))
    });
  }
};      }
    });
  } catch (err) {
    console.error('create-qris error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error di create-qris: ' + err.message
    });
  }
};
