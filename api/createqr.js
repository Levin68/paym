import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { amount } = req.body;
      if (!amount || isNaN(amount) || amount < 1000) {
        return res.status(400).json({ error: 'Nominal tidak valid. Minimal 1000.' });
      }

      // Ganti dengan Slug dan API Key yang kamu miliki
      const project = "levin";  // Slug proyek
      const api_key = "3RkaqC3a01fi45h3PPWxbRKkAH9JkcaC";  // API Key proyek

      // Membuat Order ID secara dinamis
      const now = new Date();
      const tanggal = now.toISOString().split("T")[0];  // Format YYYY-MM-DD
      const uniq = Date.now();
      const order_id = `${tanggal}-${uniq}`;

      // Request ke API Pakasir untuk membuat transaksi
      const createResRaw = await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, api_key, order_id, amount })
      });

      const createRes = await createResRaw.json();

      // Menampilkan respon dari API untuk debugging
      console.log('Response dari API:', createRes);

      if (!createRes.payment && !createRes.code) {
        return res.status(500).json({ error: 'Gagal membuat transaksi QRIS.' });
      }

      const payCode = createRes.payment ? createRes.payment.code : createRes.code;
      const qrUrl = `https://app.pakasir.com/qris/${payCode}.png`;
      res.status(200).json({ qrUrl, order_id, amount });
    } catch (error) {
      console.error('Error saat membuat transaksi QRIS:', error);
      res.status(500).json({ error: 'Terjadi kesalahan saat memproses pembayaran.' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
