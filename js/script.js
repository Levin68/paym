// js/script.js

console.log('[script] loaded');

const amountInput = document.getElementById('amount');
const createQRBtn = document.getElementById('createQRBtn');
const errorText = document.getElementById('errorText');

const resultBox = document.getElementById('resultBox');
const refText = document.getElementById('refText');
const statusText = document.getElementById('statusText');
const qrcodeContainer = document.getElementById('qrcode');

let currentRef = null;
let currentAmount = null;
let pollTimer = null;

function setError(msg) {
  if (!msg) {
    errorText.classList.add('hidden');
    errorText.textContent = '';
    return;
  }
  console.error('[UI ERROR]', msg);
  errorText.textContent = msg;
  errorText.classList.remove('hidden');
}

function renderQRImage(qrImage, fallbackString) {
  qrcodeContainer.innerHTML = '';

  const img = document.createElement('img');
  img.alt = 'QRIS';
  img.className = 'w-64 h-64 bg-white rounded-lg object-contain';

  if (qrImage && qrImage.startsWith('data:image')) {
    img.src = qrImage;
  } else if (fallbackString) {
    img.src =
      'https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=' +
      encodeURIComponent(fallbackString);
  } else {
    img.src =
      'https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=QRIS';
  }

  qrcodeContainer.appendChild(img);
}

async function createQR() {
  setError('');
  const amount = Number(amountInput.value);

  console.log('[createQR] click, amount =', amountInput.value);

  if (!amount || amount <= 0) {
    setError('Nominal belum diisi atau tidak valid.');
    return;
  }

  try {
    createQRBtn.disabled = true;
    createQRBtn.textContent = 'Membuat QR...';

    const res = await fetch('/api/create-qris', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount }),
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.error('[createQR] JSON parse error:', e);
      setError('Respon server tidak valid.');
      return;
    }

    console.log('[createQR] response =', data);

    if (!res.ok || !data || data.success !== true) {
      setError(data && data.message ? data.message : 'Gagal membuat QR.');
      return;
    }

    const { ref, amount: amt, qrImage, qrString } = data.data || {};

    currentRef = ref;
    currentAmount = amt;

    refText.textContent = ref || '-';
    statusText.textContent = 'Silakan scan QR dan lakukan pembayaran...';
    statusText.classList.remove('text-emerald-300', 'text-red-300');
    statusText.classList.add('text-amber-300');

    renderQRImage(qrImage, qrString);
    resultBox.classList.remove('hidden');

    startPolling();
  } catch (e) {
    console.error('[createQR] error:', e);
    setError(e.message || 'Terjadi kesalahan saat membuat QR.');
  } finally {
    createQRBtn.disabled = false;
    createQRBtn.textContent = 'Buat QR';
  }
}

async function checkPayment() {
  if (!currentRef || !currentAmount) return;

  try {
    const url =
      `/api/pay-status?ref=${encodeURIComponent(currentRef)}` +
      `&amount=${encodeURIComponent(currentAmount)}`;

    const res = await fetch(url);
    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.error('[checkPayment] JSON parse error:', e);
      return;
    }

    console.log('[checkPayment] response =', data);

    if (!res.ok || !data || data.success !== true) {
      console.warn(
        'Gagal cek pembayaran:',
        (data && data.message) || res.statusText
      );
      return;
    }

    const status = (data.data && data.data.status) || 'UNKNOWN';

    if (status === 'PAID') {
      statusText.textContent = '✅ Pembayaran berhasil (PAID)';
      statusText.classList.remove('text-amber-300', 'text-red-300');
      statusText.classList.add('text-emerald-300');

      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    } else if (status === 'UNPAID') {
      statusText.textContent = 'Menunggu pembayaran...';
      statusText.classList.remove('text-emerald-300', 'text-red-300');
      statusText.classList.add('text-amber-300');
    } else {
      statusText.textContent = `Status: ${status}`;
      statusText.classList.remove('text-emerald-300');
      statusText.classList.add('text-amber-300');
    }
  } catch (e) {
    console.error('[checkPayment] error:', e);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(checkPayment, 1000);
  console.log('[poll] start');
}

// pastikan fungsi global bisa dipanggil dari HTML
window.createQR = createQR;

createQRBtn.addEventListener('click', createQR);

amountInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    createQR();
  }
});
