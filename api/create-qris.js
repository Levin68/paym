// api/create-qris.js

const { QRISGenerator } = require("autoft-qris");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed. Use POST."
    });
  }

  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Nominal tidak valid"
      });
    }

    // Pastikan env tersedia
    const config = {
      storeName: "LevPay",
      auth_username: process.env.ORKUT_AUTH_USERNAME,
      auth_token: process.env.ORKUT_AUTH_TOKEN,
      baseQrString: process.env.BASE_QR_STRING,
      logoPath: null // tidak pakai logo
    };

    if (!config.auth_username || !config.auth_token || !config.baseQrString) {
      return res.status(500).json({
        success: false,
        message: "ENV tidak lengkap. Harap isi ORKUT_AUTH_USERNAME, ORKUT_AUTH_TOKEN, BASE_QR_STRING"
      });
    }

    // Generator tema default (tanpa gambar)
    const gen = new QRISGenerator(config, "theme1");

    // Buat referensi unik
    const reference = "REF" + Date.now();

    // Buat QR STRING
    const qrString = gen.generateQrString(amount);

    return res.status(200).json({
      success: true,
      data: {
        reference,
        amount,
        qrString
      }
    });

  } catch (err) {
    console.error("QR ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal membuat QR",
      error: err.toString()
    });
  }
};      message:
        'Server error: ' + (err && err.message ? err.message : 'Unknown error')
    });
  }
};
