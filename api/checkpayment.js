import axios from 'axios';

// Penyimpanan data transaksi sementara di memory
let currentTransaction = null;

/**
 * Cek status pembayaran menggunakan API Zenitsu
 */
async function checkPaymentStatus() {
  if (!currentTransaction) {
    return {
      success: false,
      error: 'No transaction data available'
    };
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
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data && response.data.statusCode === 200 && response.data.results) {
      const status = response.data.results.status;

      if (status === 'PAID') {
        return {
          success: true,
          paymentStatus: 'Payment successful',
          data: response.data.results
        };
      } else {
        return {
          success: true,
          paymentStatus: 'Waiting for payment'
        };
      }
    } else {
      return {
        success: false,
        error: 'Failed to check payment status'
      };
    }
  } catch (error) {
    console.error('❌ Error checking payment status:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * API handler untuk pengecekan pembayaran
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const paymentStatus = await checkPaymentStatus();

    if (paymentStatus.success) {
      res.status(200).json({
        success: true,
        paymentStatus: paymentStatus.paymentStatus,
        data: paymentStatus.data || {}
      });
    } else {
      res.status(500).json({
        success: false,
        error: paymentStatus.error
      });
    }
  } else {
    res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }
}
