document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = document.getElementById('amount').value;

  // Fetch data from the server to create the QRIS payment
  const response = await fetch('/api/createqr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  });
  
  const result = await response.json();
  if (result.qrUrl) {
    document.getElementById('qr-code').src = result.qrUrl;
    document.getElementById('order-id').innerText = `Order ID: ${result.order_id}`;
    document.getElementById('qr-container').style.display = 'block';
  } else {
    alert('Gagal membuat QRIS, coba lagi.');
  }
});
