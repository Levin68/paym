// js/script.js

// Coba ambil element; kalau nggak ada jangan bikin script meledak
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

// --- HELPER: ERROR UI ---
function setError(msg) {
  if (!errorText) {
    console.error('errorText element tidak ditemukan, msg:', msg);
    return;
  }
  if (!msg) {
    errorText.classList.add('hidden');
    errorText.textContent = '';
    return;
  }
  errorText.textContent = msg;
  errorText.classList.remove('hidden');
}

// --- TAMPILIN QR DI DIV #qrcode ---
function renderQR(qrString) {
  if (!qrcodeContainer) {
    console.error('qrcodeContainer (#qrcode) tidak ketemu');
    return;
  }

  if (!window.QRCode) {
    console.error('Library QRCodeJS belum termuat');
    setError('Gagal memuat library QRCode.');
    return;
  }

  qrcodeContainer.innerHTML = '';

  try {
    new QRCode(qrcodeContainer, {
      text: qrString,
      width: 256,
      height: 256,
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (e) {
    console.error('Gagal render QR:', e);
    setError('Gagal menampilkan QR di halaman.');
  }
}

// --- PANGGIL /api/create-qris ---
async function createQR() {
  setError('');

  if (!amountInput) {
    console.error('Element #amount tidak ketemu');
    setError('Form nominal tidak ditemukan di halaman.');
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

    const res = await fetch('/api/create-qris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    const data = await res.json().catch(() => null);

    console.log('[create-qris] response:', data);

    if (!res.ok || !data || data.success === false) {
      const msg =
        (data && data.message) ||
        `Gagal membuat QR (HTTP ${res.status})`;
      setError(msg);
      return;
    }

    // payload utama
    const payload = data.data || {};

    // reference bisa beda nama
    const reference =
      payload.reference ||
      payload.ref ||
      payload.Reference ||
      payload.id;

    // amount fallback ke input kalau kosong
    const amt = Number(
      payload.amount != null ? payload.amount : amount
    );

    // nama field QR string juga kita amankan
    const qrString =
      payload.qrString ||
      payload.qr_string ||
      payload.qr ||
      null;

    if (!qrString) {
      console.error('qrString tidak ada di data:', payload);
      setError('Server tidak mengirim qrString. Cek response /api/create-qris.');
      return;
    }

    currentRef = reference || null;
    currentAmount = amt;

    if (refText) {
      refText.textContent = reference || '-';
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

    // kalau mau auto cek status, buka komen ini:
    // startPolling();
  } catch (e) {
    console.error('createQR error:', e);
    setError('Terjadi kesalahan saat membuat QR.');
  } finally {
    if (createQRBtn) {
      createQRBtn.disabled = false;
      createQRBtn.textContent = 'Buat QR';
    }
  }
}

// --- OPSIONAL: PANGGIL /api/pay-status ---
async function checkPayment() {
  if (!currentRef || !currentAmount) return;

  try {
    const url =
      `/api/pay-status?reference=${encodeURIComponent(
        currentRef
      )}&amount=${currentAmount}`;

    const res = await fetch(url);
    const data = await res.json().catch(() => null);

    console.log('[pay-status] response:', data);

    if (!res.ok || !data || data.success === false) {
      console.warn(
        'Gagal cek pembayaran:',
        (data && data.message) || res.statusText
      );
      return;
    }

    const status = (data.data && data.data.status) || 'UNKNOWN';

    if (!statusText) return;

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
    console.error('checkPayment error:', e);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(checkPayment, 1000);
}

// --- DAFTARKAN EVENT LISTENER (dengan pengecekan supaya nggak crash) ---
if (createQRBtn) {
  createQRBtn.addEventListener('click', createQR);
} else {
  console.error('Button #createQRBtn tidak ditemukan di DOM');
}

if (amountInput) {
  amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createQR();
  });
} else {
  console.error('Input #amount tidak ditemukan di DOM');
}
