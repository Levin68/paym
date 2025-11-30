// js/script.js

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-generate');
  const amountInput = document.getElementById('amount');
  const themeSelect = document.getElementById('theme');
  const qrSection = document.getElementById('qr-section');
  const qrImg = document.getElementById('qr-img');
  const refText = document.getElementById('ref-text');
  const amountText = document.getElementById('amount-text');
  const statusBox = document.getElementById('status-box');

  let currentRef = null;
  let currentAmount = null;
  let pollTimer = null;

  function formatRupiah(n) {
    n = Number(n || 0);
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  function setStatus(type, message) {
    let className = 'badge-pending';
    if (type === 'paid') className = 'badge-paid';
    else if (type === 'error') className = 'badge-error';
    statusBox.innerHTML =
      '<span class="' + className + '">' + message + '</span>';
  }

  async function generateQr() {
    const amount = Number(amountInput.value);
    const theme = themeSelect.value;

    if (!amount || amount <= 0) {
      alert('Nominal tidak valid');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Membuat QR...';

    try {
      const res = await fetch('/api/create-qris', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount, theme })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Gagal generate QR');
      }

      const { ref, qrImage, amount: amt } = json.data;

      currentRef = ref;
      currentAmount = amt;

      qrImg.src = qrImage;
      refText.textContent = ref;
      amountText.textContent = formatRupiah(amt);
      qrSection.style.display = 'block';
      setStatus('pending', 'Menunggu pembayaran...');

      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(pollStatus, 3000);
    } catch (err) {
      console.error(err);
      setStatus('error', 'Error: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate QRIS';
    }
  }

  async function pollStatus() {
    if (!currentRef) return;
    try {
      const url =
        '/api/pay-status?ref=' +
        encodeURIComponent(currentRef) +
        '&amount=' +
        encodeURIComponent(currentAmount || '');
      const res = await fetch(url);
      const json = await res.json();

      const status =
        json?.data?.status ||
        json?.status ||
        json?.data?.payment_status ||
        '';

      const upper = String(status).toUpperCase();

      if (upper === 'PAID' || upper === 'SUCCESS' || upper === 'COMPLETED') {
        setStatus('paid', 'Pembayaran berhasil (status: ' + upper + ')');
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } else {
        setStatus('pending', 'Status: ' + (upper || 'UNKNOWN'));
      }
    } catch (err) {
      console.error(err);
      setStatus('error', 'Error cek status');
    }
  }

  btn.addEventListener('click', generateQr);
});
