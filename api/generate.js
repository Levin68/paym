import axios from 'axios';

// Konfigurasi Zenitsu API
const ZENITSU_CONFIG = {
  username: 'vinzyy',  // Ganti dengan username orkut Anda
  token: '1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh'     // Ganti dengan token orkut Anda
};

let currentTransaction = null;  // Untuk menyimpan transaksi yang sedang berjalan

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
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.statusCode === 200 && response.data.results) {
      // Simpan informasi transaksi untuk digunakan nanti di checkPayment
      currentTransaction = {
        idtrx: response.data.results.idtrx,
        createAt: response.data.results.createAt,
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token,
        amount: response.data.results.amount,
        expired: new Date(response.data.results.expired),
        qrUrl: response.data.results.url
      };
      return {
        success: true,
        data: currentTransaction
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
 * Check payment status from mutasi
 */
async function checkPaymentStatus() {
  if (!currentTransaction) {
    return { status: 'error', message: 'No transaction found' };
  }

  try {
    const response = await axios.post(
      'https://api.zenitsu.web.id/api/orkut/mutasi',
      {
        username: currentTransaction.username,
        token: currentTransaction.token
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.statusCode === 200 && response.data.results) {
      const mutasi = response.data.results;

      const payment = mutasi.find(transaction => {
        try {
          const [datePart, timePart] = transaction.tanggal.split(' ');
          const [day, month, year] = datePart.split('/');
          const transactionDate = new Date(`${year}-${month}-${day}T${timePart}:00`);

          const isRecent = transactionDate >= currentTransaction.expired;
          const isIncoming = transaction.status === 'IN';

          const transactionAmount = parseInt(transaction.kredit.replace(/./g, ''));
          const amountMatch = transactionAmount === currentTransaction.amount;

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
    console.error('❌ Error checking payment status:', error.message);
    return { status: 'error', message: error.message };
  }
}

/**
 * API handler untuk membuat QR dan memeriksa status pembayaran
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    console.log(`Generating QR for amount: Rp ${amount}`);
    
    const qrResult = await generateQRCode(amount);

    if (!qrResult.success) {
      return res.status(500).json({
        success: false,
        error: qrResult.error
      });
    }

    const qrData = qrResult.data;
    res.status(200).json({
      success: true,
      data: qrData
    });

    // Start checking payment status every 5 seconds
    const checkInterval = setInterval(async () => {
      const paymentStatus = await checkPaymentStatus();

      if (paymentStatus.status === 'paid') {
        clearInterval(checkInterval);
        console.log('🎉 Payment successful!');
        // Return status as success after payment is received
        return res.status(200).json({
          success: true,
          paymentStatus: 'Payment successful',
          qrData
        });
      } else if (paymentStatus.status === 'pending') {
        console.log(`Waiting for payment...`);
      } else {
        console.log('Error checking payment:', paymentStatus.message);
      }
    }, 5000);
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
