import axios from 'axios';

const ZENITSU_CONFIG = {
  username: process.env.ORKUT_AUTH_USERNAME,  // username dari Zenitsu
  token: process.env.ORKUT_AUTH_TOKEN,  // token dari Zenitsu
};

async function generateQr(amount, idTransaksi) {
  try {
    const response = await axios.post(
      'https://zenitsu.web.id/api/orkut/createqr',
      {
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token,
        idtrx: idTransaksi,
        amount: amount.toString()
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.statusCode === 200 && response.data.results) {
      return {
        success: true,
        data: {
          idTransaksi: response.data.results.idtrx,
          amount: response.data.results.amount,
          expired: new Date(response.data.results.expired),
          qrUrl: response.data.results.url
        }
      };
    } else {
      return {
        success: false,
        error: 'Failed to generate QR code'
      };
    }
  } catch (error) {
    console.error('❌ Error generating QR code:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export default async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount invalid' });
      }

      const idTransaksi = 'LEVPAY_' + Math.floor(Math.random() * 100000); // Ganti dengan ID yang unik
      const result = await generateQr(amount, idTransaksi);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(500).json({ success: false, message: result.error });
      }
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  } else {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
};
