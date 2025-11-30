// public/js/script.js

(() => {
  const amountInput = document.getElementById('amountInput');
  const generateBtn = document.getElementById('generateBtn');
  const qrImage = document.getElementById('qrImage');
  const currentRefEl = document.getElementById('currentRef');
  const currentAmountEl = document.getElementById('currentAmount');
  const statusBadge = document.getElementById('statusBadge');

  let activeRef = null;
  let activeAmount = null;
  let pollTimer = null;

  // status2 yang dianggap "lunas"
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

  // ===== helper DOM =====
  function formatRupiah(n) {
    const num = Number(n || 0);
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  function setStatusWaiting() {
    statusBadge.textContent = 'STATUS: MENUNGGU';
    statusBadge.classList.remove(
      'status-pill--paid',
      'status-pill--failed',
      'status-pill--unknown'
    );
    statusBadge.classList.add('status-pill--waiting');
  }

  function setStatusPaid(text) {
    statusBadge.textContent = text || 'STATUS: BERHASIL';
    statusBadge.classList.remove(
      'status-pill--waiting',
      'status-pill--failed',
      'status-pill--unknown'
    );
    statusBadge.classList.add('status-pill--paid');
  }

  function setStatusFailed(text) {
    statusBadge.textContent =
      text || 'STATUS: GAGAL / DITOLAK';
    statusBadge.classList.remove(
      'status-pill--waiting',
      'status-pill--paid',
      'status-pill--unknown'
    );
    statusBadge.classList.add('status-pill--failed');
  }

  function setStatusUnknown(text) {
    statusBadge.textContent =
      text || 'STATUS: TIDAK DIKETAHUI';
    statusBadge.classList.remove(
      'status-pill--waiting',
      'status-pill--paid',
      'status-pill--failed'
    );
    statusBadge.classList.add('status-pill--unknown');
  }

  // ===== helper ambil status dari JSON backend =====
  function extractStatusFromResponse(json) {
    if (!json || typeof json !== 'object') return null;

    if (typeof json.status === 'string') {
      return json.status;
    }

    if (
      json.normalized &&
      typeof json.normalized.status === 'string'
    ) {
      return json.normalized.status;
    }

    if (
      json.data &&
      typeof json.data.status === 'string'
    ) {
      return json.data.status;
    }

    return null;
  }

  // ===== generate QR =====
  async function handleGenerate() {
    const rawAmount = amountInput.value.trim();
    const amount = Number(rawAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Nominal tidak valid');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
      const res = await fetch('/api/create-qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          theme: 'theme1'
        })
      });

      const json = await res.json();

      if (!res.ok || !json || json.success === false) {
        console.error('create-qris error:', json);
        alert(
          json && json.message
            ? json.message
            : 'Gagal generate QRIS'
        );
        return;
      }

      // asumsi response: { success:true, data:{ ref, amount, qrImage } }
      const data = json.data || json;
      activeRef = data.ref;
      activeAmount = data.amount || amount;

      if (data.qrImage) {
        qrImage.src = data.qrImage; // sudah data:image/png;base64,...
      }

      currentRefEl.textContent = activeRef || '-';
      currentAmountEl.textContent = formatRupiah(activeAmount);
      setStatusWaiting();

      // mulai polling
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(checkStatusOnce, 2000);
    } catch (e) {
      console.error(e);
      alert('Terjadi kesalahan saat generate QR');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate QRIS';
    }
  }

  // ===== cek status sekali =====
  async function checkStatusOnce() {
    if (!activeRef || !activeAmount) return;

    try {
      const url =
        '/api/pay-status?ref=' +
        encodeURIComponent(activeRef) +
        '&amount=' +
        encodeURIComponent(activeAmount);

      const res = await fetch(url, { method: 'GET' });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        console.warn('pay-status tidak OK', res.status);
        return;
      }

      const statusRaw = extractStatusFromResponse(json);
      if (!statusRaw) {
        // belum ada info → biarin MENUNGGU
        return;
      }

      const status = statusRaw.toString().toUpperCase();

      if (paidStatuses.has(status)) {
        setStatusPaid(`STATUS: BERHASIL (${status})`);
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } else if (
        ['FAILED', 'CANCEL', 'CANCELLED', 'EXPIRED', 'VOID', 'REJECT', 'DENY', 'ERROR'].includes(
          status
        )
      ) {
        setStatusFailed(`STATUS: ${status}`);
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } else {
        // status lain (PENDING, WAITING, dll) → cuma update teks, tetap kuning
        statusBadge.textContent = `STATUS: ${status}`;
        statusBadge.classList.remove(
          'status-pill--paid',
          'status-pill--failed',
          'status-pill--unknown'
        );
        statusBadge.classList.add('status-pill--waiting');
      }
    } catch (e) {
      console.error('checkStatus error', e);
      // kalau error sekali-sekali, biarin aja, nanti interval berikutnya coba lagi
    }
  }

  // ===== init =====
  generateBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleGenerate();
  });
})();
