// js/script.js

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-generate');
  const amountInput = document.getElementById('amount');
  const qrSection = document.getElementById('qr-section');
  const qrPlaceholder = document.getElementById('qr-placeholder');
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

  function setStatus(kind, message) {
    let badgeClass = 'badge-pending';
    let statusClass = 'status-pending';

    if (kind === 'paid') {
      badgeClass = 'badge-paid';
      statusClass = 'status-paid';
    } else if (kind === 'error') {
      badgeClass = 'badge-error';
      statusClass = 'status-error';
    }

    statusBox.innerHTML =
      '<span class="' +
      badgeClass +
      ' ' +
      statusClass +
      '"><span class="status-icon"></span>' +
      message +
      '</span>';
  }

  async function generateQr() {
    const amount = Number(amountInput.value);
    const theme = 'theme1'; // fixed, nggak pake dropdown tema-temaan

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
      qrPlaceholder.style.display = 'none';
      qrSection.style.display = 'block';

      refText.textContent = ref;
      amountText.textContent = formatRupiah(amt);
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

      if (!res.ok || json.success === false) {
        // kalau normalisasi gagal / ada error lain, tampilkan message
        const msg =
          json.message ||
          (res.ok ? 'Gagal membaca status' : 'HTTP ' + res.status);
        setStatus('error', msg);
        return;
      }

      // bentuk dari backend: { success:true, data:{ status, amount, ref, paidAt, raw } }
      const status =
        json?.data?.status ||
        json?.status ||
        json?.data?.payment_status ||
        json?.payment_status ||
        '';

      const upper = String(status || '').toUpperCase();

      const paidStatuses = new Set([
        'PAID',
        'SUCCESS',
        'COMPLETED',
        'SETTLEMENT',
        'CAPTURE',
        'CONFIRMED',
        'SUCCESSFUL',
        'PAID_OFF',
        'DONE'
      ]);

      if (paidStatuses.has(upper)) {
        setStatus('paid', 'Pembayaran berhasil (' + upper + ')');
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } else {
        setStatus('pending', 'Status: ' + (upper || 'MENUNGGU'));
      }
    } catch (err) {
      console.error(err);
      setStatus('error', 'Error cek status');
    }
  }

  btn.addEventListener('click', generateQr);
});
