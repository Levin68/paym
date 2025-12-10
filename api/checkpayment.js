import axios from 'axios';

// Ambil data transaksi yang sudah disimpan sebelumnya
let currentTransaction = null;  // Harus sudah diisi sebelumnya di generateQRCode()

/**
 * Cek status pembayaran menggunakan API Zenitsu
 */
async function checkPaymentStatus() {
  if (!currentTransaction) {
    return { status: 'error', message: 'No transaction data available' };
  }

  try {
    const response = await axios.post(
      'https://api.zenitsu.web.id/api/orkut/checkpayment',
      {
        username: currentTransaction.username,
        token: currentTransaction.token,
        idtrx: currentTransaction.idtrx,
        amount: currentTransaction.amount.toString(),
        createdAt: currentTransaction.createAt
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.statusCode === 200 && response.data.results) {
      const status = response.data.results.status;
      if (status === 'PAID') {
        return { status: 'paid', data: response.data.results };
      } else {
        return { status: 'pending' };
      }
    } else {
      return { status: 'error', message: 'Failed to check payment status' };
    }
  } catch (error) {
    console.error('❌ Error checking payment status:', error.message);
    return { status: 'error', message: error.message };
  }
}

/**
 * API handler untuk pengecekan pembayaran
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const paymentStatus = await checkPaymentStatus();

    if (paymentStatus.status === 'paid') {
      return res.status(200).json({
        success: true,
        paymentStatus: 'Payment successful',
        data: paymentStatus.data
      });
    } else if (paymentStatus.status === 'pending') {
      return res.status(200).json({
        success: true,
        paymentStatus: 'Waiting for payment'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: paymentStatus.message
      });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
