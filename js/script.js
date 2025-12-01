// js/script.js

console.log('script.js loaded');

const amountInput      = document.getElementById('amount');
const createQRBtn      = document.getElementById('createQRBtn');
const errorText        = document.getElementById('errorText');

const resultBox        = document.getElementById('resultBox');
const refText          = document.getElementById('refText');
const statusText       = document.getElementById('statusText');
const qrcodeContainer  = document.getElementById('qrcode');

let currentRef   = null;
let currentAmount = null;
let pollTimer    = null;

// === helper error ===
function setError(msg) {
  if (!errorText) return;

  if (!msg) {
    errorText.classList.add('hidden');
    errorText.textContent = '';
    return;
  }
  errorText.textContent = msg;
  errorText.classList.remove('hidden');
}

// === render QR di browser pakai qrString dari server ===
function renderQR(qrString) {
  if (!qrcodeContainer) return;

  // bersihkan dulu
  qrcodeContainer.innerHTML = '';

  if (!qrString) {
    qrcodeContainer.textContent = 'QR tidak tersedia.';
    return;
  }

  if (typeof QRCode === 'undefined') {
    console.error('QRCode library belum ke-load');
    qrcodeContainer.textContent = 'QRCode library belum ke-load.';
    return;
  }

  new QRCode(qrcodeContainer, {
    text: qrString,
    width: 256,
    height: 256,
    correctLevel: QRCode.CorrectLevel.M
  });
}

// === panggil /api/create-qris ===
async function createQR() {
  setError('');

  if (!amountInput) {
    console.error('amount input tidak ditemukan');
    return;
  }

  const amount = Number(amountInput.value);

  if (!amount || amount <= 0) {
    setError('Nominal belum diisi atau tidak valid.');
    return;
  }

  try {
    if (createQRBtn) {
      createQRBtn.disabled = true;
      createQRBtn.textContent = 'Membuat QR...';
    }

    console.log('call /api/create-qris dengan amount:', amount);

    const res = await fetch('/api/create-qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    const data = await res.json().catch(() => ({}));

    console.log('res create-qris:', data);

    if (!res.ok || !data || data.success === false) {
      throw new Error((data && data.message) || 'Gagal membuat QR');
    }

    // bentuk data dari server (yang tadi panjang) kira-kira:
    // { success:true, data:{ ref, amount, qrString, qrImage } }
    const payload = data.data || {};
    const ref      = payload.ref || payload.reference || 'UNKNOWN';
    const nominal  = payload.amount || amount;
    const qrString = payload.qrString;

    currentRef    = ref;
    currentAmount = nominal;

    if (refText) {
      refText.textContent = ref;
    }

    if (statusText) {
      statusText.textContent = 'Silakan scan QR dan lakukan pembayaran...';
      statusText.classList.remove('text-emerald-300', 'text-red-300');
      statusText.classList.add('text-amber-300');
    }

    renderQR(qrString);

    if (resultBox) {
      resultBox.classList.remove('hidden');
    }

    startPolling();
  } catch (e) {
    console.error('createQR error:', e);
    setError(e.message || 'Terjadi kesalahan saat membuat QR.');
  } finally {
    if (createQRBtn) {
      createQRBtn.disabled = false;
      createQRBtn.textContent = 'Buat QR';
    }
  }
}

// === panggil /api/pay-status tiap 1 detik ===
async function checkPayment() {
  if (!currentRef || !currentAmount) return;

  try {
    const url = `/api/pay-status?reference=${encodeURIComponent(
      currentRef
    )}&amount=${currentAmount}`;

    console.log('polling:', url);

    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));

    console.log('res pay-status:', data);

    if (!res.ok || !data || data.success === false) {
      console.warn('Gagal cek pembayaran:', data && data.message);
      return;
    }

    // asumsi server balikin:
    // { success:true, data:{ status:'PAID' | 'UNPAID' | ... } }
    const payload = data.data || data;
    const status  = (payload.status || '').toString().toUpperCase();

    if (!statusText) return;

    if (status === 'PAID') {
      statusText.textContent = '✅ Pembayaran berhasil (PAID)';
      statusText.classList.remove('text-amber-300', 'text-red-300');
      statusText.classList.add('text-emerald-300');

      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    } else if (status === 'UNPAID' || !status) {
      statusText.textContent = 'Menunggu pembayaran...';
      statusText.classList.remove('text-emerald-300', 'text-red-300');
      statusText.classList.add('text-amber-300');
    } else {
      statusText.textContent = `Status: ${status}`;
      statusText.classList.remove('text-emerald-300');
      statusText.classList.add('text-amber-300');
    }
  } catch (e) {
    console.error('poll error:', e);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(checkPayment, 1000); // tiap 1 detik
}

// === pasang event listener ===
if (createQRBtn) {
  createQRBtn.addEventListener('click', createQR);
} else {
  console.error('createQRBtn tidak ditemukan di DOM');
}

if (amountInput) {
  amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      createQR();
    }
  });
}
