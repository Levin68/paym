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
    const theme = 'theme1'; // kita fix theme1 aja

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

  // cari field status DI MANA SAJA di dalam objek JSON
  function deepFindStatus(obj) {
    if (!obj || typeof obj !== 'object') return '';

    let found = '';

    function dfs(o) {
      if (!o || typeof o !== 'object' || found) return;
      for (const key in o) {
        if (!Object.prototype.hasOwnProperty.call(o, key)) continue;
        const v = o[key];
        const k = key.toLowerCase();

        if (
          k === 'status' ||
          k === 'payment_status' ||
          k === 'transaction_status'
        ) {
          if (typeof v === 'string' || typeof v === 'number') {
            found = String(v);
            return;
          }
        }

        if (v && typeof v === 'object') {
          dfs(v);
          if (found) return;
        }
      }
    }

    dfs(obj);
    return found;
  }

  function extractStatusFromResponse(json) {
    // coba dulu dari data yang sudah dinormalisasi backend
    if (json && json.data && json.data.status) {
      return String(json.data.status).toUpperCase();
    }

    // kalau nggak ada, coba deep search di raw
    if (json && json.raw) {
      const s = deepFindStatus(json.raw);
      if (s) return s.toUpperCase();
    }

    // terakhir, deep search di objek penuh (kalau backend belum pakai field raw)
    const s2 = deepFindStatus(json);
    return s2 ? s2.toUpperCase() : '';
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
