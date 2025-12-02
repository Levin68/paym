const fetch = require('node-fetch'); // Pastikan menggunakan 'node-fetch' jika di Node.js

// Fungsi untuk menghandle permintaan status pembayaran
async function checkPaymentStatus(reference, amount) {
  try {
    // Coba ambil status pembayaran dari API eksternal
    const response = await fetch(`https://paym-cyan.vercel.app/api/pay-status?reference=${reference}&amount=${amount}`, {
      method: 'GET', // atau 'POST' tergantung API
      headers: { 'Cache-Control': 'no-cache' }
    });

    // Pastikan API merespons dengan status 200
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Ambil data JSON dari API
    const data = await response.json();
    
    // Cek apakah status berhasil atau tidak
    if (data.success) {
      console.log('Status:', data.status);
      return data; // Kembalikan data jika berhasil
    } else {
      throw new Error(data.raw.error); // Kalau ada error di raw
    }
  } catch (error) {
    console.error('Error while checking payment status:', error.message);
    
    // Jika API gagal atau error lainnya, kita bisa kembalikan status UNKNOWN
    return {
      success: true,
      reference,
      amount,
      status: 'UNKNOWN',
      raw: {
        success: false,
        error: `Gagal cek status pembayaran: ${error.message}`
      }
    };
  }
}

// Fungsi untuk mengecek saldo
async function checkBalance() {
  try {
    const response = await fetch("https://paym-cyan.vercel.app/api/debug-saldo", {
      method: "GET",
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const balanceData = await response.json();
    return balanceData;
  } catch (error) {
    console.error('Error while checking balance:', error.message);
    return { success: false, error: `Gagal cek saldo: ${error.message}` };
  }
}

// Contoh penggunaan
const reference = 'LEVPAY00001';
const amount = 1000;

checkPaymentStatus(reference, amount)
  .then(status => {
    console.log('Payment Status:', status);
  })
  .catch(err => {
    console.error('Error in checkPaymentStatus:', err);
  });

checkBalance()
  .then(balance => {
    console.log('Balance Status:', balance);
  })
  .catch(err => {
    console.error('Error in checkBalance:', err);
  });
