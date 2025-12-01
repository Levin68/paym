// js/script.js

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
let qrInstance = null;

function setError(msg) {
  if (!msg) {
    errorText.classList.add('hidden');
    errorText.textContent = '';
    return;
  }
  errorText.textContent = msg;
  errorText.classList.remove('hidden');
}

function renderQR(qrString) {
  // bersihin dulu
  qrcodeContainer.innerHTML = '';

  qrInstance = new QRCode(qrcodeContainer, {
    text: qrString,
    width: 256,
    height: 256,
    correctLevel: QRCode.CorrectLevel.M
  });
}

async function createQR() {
  setError('');
  const amount = Number(amountInput.value);

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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Gagal membuat QR');
    }

    const { reference, amount: amt, qrString } = data.data;

    currentRef = reference;
    currentAmount = amt;

    refText.textContent = reference;
    statusText.textContent = 'Silakan scan QR dan lakukan pembayaran...';
    statusText.classList.remove('text-emerald-300', 'text-red-300');
    statusText.classList.add('text-amber-300');

    renderQR(qrString);
    resultBox.classList.remove('hidden');

    startPolling();
  } catch (e) {
    console.error(e);
    setError(e.message || 'Terjadi kesalahan saat membuat QR.');
  } finally {
    createQRBtn.disabled = false;
    createQRBtn.textContent = 'Buat QR';
  }
}

async function checkPayment() {
  if (!currentRef || !currentAmount) return;

  try {
    const url = `/api/pay-status?reference=${encodeURIComponent(
      currentRef
    )}&amount=${currentAmount}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.success) {
      console.warn('Gagal cek pembayaran:', data.message || res.statusText);
      return;
    }

    const status = data.data.status; // 'PAID', 'UNPAID', etc

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
    console.error('poll error', e);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  // tiap 1 detik
  pollTimer = setInterval(checkPayment, 1000);
}

createQRBtn.addEventListener('click', createQR);

amountInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    createQR();
  }
});
