import axios from 'axios';

// Konfigurasi Zenitsu API
const ZENITSU_CONFIG = {
  username: 'vinzyy',  // Username
  token: '1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh'  // Token
};

// Fungsi untuk mengecek status pembayaran menggunakan mutasi
async function checkPaymentStatusFromMutasi(idTransaksi, amount) {
  try {
    const response = await axios.post(
      'https://api.zenitsu.web.id/api/orkut/mutasi',
      {
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data && response.data.statusCode === 200 && response.data.results) {
      const mutasi = response.data.results;

      // Cek apakah transaksi ada dalam mutasi dalam 5 menit terakhir
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const payment = mutasi.find(transaction => {
        try {
          const [datePart, timePart] = transaction.tanggal.split(' ');
          const [day, month, year] = datePart.split('/');
          const transactionDate = new Date(`${year}-${month}-${day}T${timePart}:00`);

          const isRecent = transactionDate >= fiveMinutesAgo;
          const isIncoming = transaction.status === 'IN';

          const transactionAmount = parseInt(transaction.kredit.replace(/./g, ''));
          const amountMatch = transactionAmount === amount;

          // Cek apakah transaksi sesuai dengan ID dan jumlahnya
          return isRecent && isIncoming && amountMatch;
        } catch (e) {
          console.log('❌ Error parsing transaction:', e);
          return false;
        }
      });

      if (payment) {
        return { status: 'paid', data: payment };
      } else {
        return { status: 'pending' };
      }
    }

    return { status: 'error', message: 'Failed to fetch mutation data' };
  } catch (error) {
    console.error('❌ Error checking payment status from mutasi:', error.message);
    return { status: 'error', message: error.message };
  }
}

/**
 * API handler untuk pengecekan pembayaran dari mutasi
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { idTransaksi, amount } = req.body;

    if (!idTransaksi || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction data'
      });
    }

    const paymentStatus = await checkPaymentStatusFromMutasi(idTransaksi, amount);

    if (paymentStatus.status === 'paid') {
      res.status(200).json({
        success: true,
        paymentStatus: 'Payment successful',
        data: paymentStatus.data
      });
    } else if (paymentStatus.status === 'pending') {
      res.status(200).json({
        success: true,
        paymentStatus: 'Waiting for payment'
      });
    } else {
      res.status(500).json({
        success: false,
        error: paymentStatus.message || 'Error checking payment status'
      });
    }
  } else {
    res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }
}
