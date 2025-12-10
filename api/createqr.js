import axios from 'axios';

// Konfigurasi Zenitsu API dengan username dan token yang diberikan
const ZENITSU_CONFIG = {
  username: 'vinzyy',  // Username
  token: '1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh'  // Token
};

// Global variable untuk menyimpan data transaksi
let currentTransaction = null;  // Menyimpan transaksi yang sedang berjalan

/**
 * Generate QR Code using Zenitsu API
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
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data && response.data.statusCode === 200 && response.data.results) {
      // Menyimpan data transaksi untuk digunakan nanti di checkpayment
      currentTransaction = {
        idtrx: response.data.results.idtrx,
        amount: response.data.results.amount,
        createAt: response.data.results.createAt,
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token,
        expired: new Date(response.data.results.expired),
        qrUrl: response.data.results.url
      };

      return {
        success: true,
        data: currentTransaction
      };
    } else {
      return { success: false, error: 'Failed to generate QR code' };
    }
  } catch (error) {
    console.error('❌ Error generating QR code:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * API handler untuk generate QR
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const qrResult = await generateQRCode(amount);

    if (!qrResult.success) {
      return res.status(500).json({
        success: false,
        error: qrResult.error
      });
    }

    res.status(200).json({
      success: true,
      data: {
        idTransaksi: qrResult.data.idtrx,
        amount: qrResult.data.amount,
        expired: qrResult.data.expired,
        qrUrl: qrResult.data.qrUrl
      }
    });
  } else {
    res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }
}
