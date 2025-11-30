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
    const theme = 'theme1';

    if (!amount || amount <= 0) {
      alert('Nominal tidak valid');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Membuat QR...';

    try {
      const res = await fetch('/api/create-qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, theme })
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
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

  function extractStatusFromResponse(json) {
    // Normalized dulu
    if (json && json.data && json.data.status) {
      return String(json.data.status).toUpperCase();
    }

    // Kalau nggak ada, coba cari di raw
    const raw = json && json.raw ? json.raw : json;

    const candidate =
      (raw &&
        (raw.status ||
          raw.payment_status ||
          raw.transaction_status ||
          (raw.data && (raw.data.status || raw.data.payment_status)))) ||
      '';

    return String(candidate || '').toUpperCase();
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

      if (!res.ok) {
        setStatus('error', 'HTTP ' + res.status);
        return;
      }

      // Backend sekarang SELALU success:true kalau nggak throw
      const upper = extractStatusFromResponse(json);

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
      } else if (upper) {
        setStatus('pending', 'Status: ' + upper);
      } else {
        setStatus('pending', 'Status: MENUNGGU');
      }
    } catch (err) {
      console.error(err);
      setStatus('error', 'Error cek status');
    }
  }

  btn.addEventListener('click', generateQr);
});
