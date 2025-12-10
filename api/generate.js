import axios from 'axios';

// Konfigurasi Zenitsu API
const ZENITSU_CONFIG = {
  username: 'vinzyy',  // Ganti dengan username orkut Anda
  token: '1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh'     // Ganti dengan token orkut Anda
};

// Utility untuk generate ID transaksi
function generateRandomString(prefix = 'LEVPAY-') {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 10;
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Generate QR Code menggunakan Zenitsu API
 */
async function generateQRCode(amount) {
  try {
    const response = await axios.post(
      'https://api.zenitsu.web.id/api/orkut/createqr',
      {
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token,
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

/**
 * API handler untuk membuat QR
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    console.log(`Generating QR for amount: Rp ${amount}`);
    
    const qrResult = await generateQRCode(amount);

    if (qrResult.success) {
      return res.status(200).json({
        success: true,
        data: qrResult.data
      });
    } else {
      return res.status(500).json({
        success: false,
        error: qrResult.error
      });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
