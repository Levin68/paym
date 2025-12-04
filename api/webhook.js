export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const data = req.body;
      console.log('Webhook dari Pakasir:', data);

      const { status, order_id, amount } = data;

      // Menangani status pembayaran
      if (status === 'completed') {
        console.log(`Pembayaran berhasil untuk Order ID: ${order_id}, Nominal: ${amount}`);
        // Update status di sistem atau database
      } else if (status === 'failed' || status === 'expired') {
        console.log(`Pembayaran gagal atau expired untuk Order ID: ${order_id}`);
        // Lakukan tindakan untuk pembayaran gagal
      }

      // Mengirim respons 200 OK ke Pakasir
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error saat memproses webhook:', error);
      res.status(500).json({ error: 'Terjadi kesalahan saat memproses webhook.' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });  // Menangani selain POST
  }
}
