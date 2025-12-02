import axios from 'axios';

const ZENITSU_CONFIG = {
  username: process.env.ORKUT_AUTH_USERNAME,  // username dari Zenitsu
  token: process.env.ORKUT_AUTH_TOKEN,  // token dari Zenitsu
};

async function checkPaymentStatus() {
  try {
    const response = await axios.post(
      'https://zenitsu.web.id/api/orkut/mutasi',
      {
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token
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
          const amountMatch = transactionAmount === expectedAmount;

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

export default async (req, res) => {
  if (req.method === 'GET') {
    try {
      const { reference, amount } = req.query;
      if (!reference || !amount) {
        return res.status(400).json({ success: false, message: 'Reference and Amount are required' });
      }

      const paymentStatus = await checkPaymentStatus(reference, amount);
      
      return res.status(200).json({
        success: true,
        data: {
          reference,
          amount,
          status: paymentStatus.status,
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  } else {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }
};
