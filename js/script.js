// js/script.js

// Ambil elemen DOM
const amountInput = document.getElementById("amount");
const btnGenerate = document.getElementById("btn-generate");

const qrSection = document.getElementById("qr-section");      // wrapper IMG
const qrPlaceholder = document.getElementById("qr-placeholder");
const qrImg = document.getElementById("qr-img");

const refText = document.getElementById("ref-text");
const amountText = document.getElementById("amount-text");
const statusBox = document.getElementById("status-box");

let currentRef = null;
let currentAmount = null;
let pollTimer = null;

// ---------------- Helper kecil ----------------

function formatRupiah(n) {
  const num = Number(n || 0);
  return "Rp" + num.toLocaleString("id-ID");
}

function setStatus(type, msg) {
  // type: idle | pending | paid | error
  if (!statusBox) return;

  let badgeClass = "badge-pending";
  let statusClass = "status-pending";
  let label = "MENUNGGU";

  if (type === "paid") {
    badgeClass = "badge-paid";
    statusClass = "status-paid";
    label = "PAID";
  } else if (type === "error") {
    badgeClass = "badge-error";
    statusClass = "status-error";
    label = "ERROR";
  } else if (type === "idle") {
    badgeClass = "badge-pending";
    statusClass = "status-pending";
    label = "IDLE";
  }

  const text = msg || (type === "paid"
    ? "Pembayaran berhasil terkonfirmasi."
    : type === "pending"
    ? "Silakan scan QRIS dan lakukan pembayaran."
    : type === "error"
    ? "Terjadi kesalahan saat memproses."
    : "Belum ada transaksi aktif.");

  statusBox.innerHTML = `
    <div class="${statusClass}">
      <span class="${badgeClass}">
        <span class="status-icon"></span>
        <span>${label}</span>
      </span>
      <span style="margin-left:6px;">${text}</span>
    </div>
  `;
}

function showPlaceholder() {
  if (qrSection) qrSection.style.display = "none";
  if (qrPlaceholder) qrPlaceholder.style.display = "block";
  setStatus("idle");
}

function showQR() {
  if (qrPlaceholder) qrPlaceholder.style.display = "none";
  if (qrSection) qrSection.style.display = "block";
}

// ---------------- Panggil /api/create-qris ----------------

async function handleCreateQR() {
  if (!amountInput) return;

  const amount = Number(amountInput.value);

  if (!amount || amount <= 0) {
    setStatus("error", "Nominal belum diisi atau tidak valid.");
    return;
  }

  // Matikan polling lama kalau ada
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  try {
    if (btnGenerate) {
      btnGenerate.disabled = true;
      btnGenerate.innerText = "Generating...";
    }

    setStatus("pending", "Menghubungi server untuk membuat QRIS...");

    const res = await fetch("/api/create-qris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });

    const data = await res.json().catch(() => null);
    console.log("[create-qris] response:", data);

    if (!res.ok || !data || data.success === false) {
      const msg =
        (data && data.message) ||
        `Gagal membuat QRIS (HTTP ${res.status}).`;
      setStatus("error", msg);
      showPlaceholder();
      return;
    }

    const payload = data.data || {};

    const reference =
      payload.reference ||
      payload.ref ||
      payload.id ||
      null;

    const nominal =
      payload.amount != null ? Number(payload.amount) : amount;

    const qrImage =
      payload.qrImage ||
      payload.qr_image ||
      null;

    const qrString = payload.qrString || payload.qr_string || null;

    if (!qrImage && !qrString) {
      setStatus("error", "Server tidak mengirim qrImage / qrString.");
      showPlaceholder();
      return;
    }

    // Set state global
    currentRef = reference;
    currentAmount = nominal;

    if (refText) {
      refText.textContent = reference || "—";
    }
    if (amountText) {
      amountText.textContent = formatRupiah(nominal);
    }

    // Tampilkan QR
    if (qrImg) {
      if (qrImage) {
        // kalau backend sudah kirim base64 siap pakai
        qrImg.src = qrImage;
      } else if (qrString) {
        // Fallback: bikin QR via API publik (URL bisa agak panjang tapi masih aman)
        const encoded = encodeURIComponent(qrString);
        qrImg.src =
          "https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" +
          encoded;
      }
    }

    showQR();
    setStatus(
      "pending",
      "QRIS siap. Silakan scan. Sistem akan cek status tiap beberapa detik."
    );

    // Mulai polling status
    startPolling();
  } catch (e) {
    console.error("create-qris error:", e);
    setStatus("error", "Terjadi kesalahan pada jaringan / server.");
    showPlaceholder();
  } finally {
    if (btnGenerate) {
      btnGenerate.disabled = false;
      btnGenerate.innerText = "Generate QRIS";
    }
  }
}

// ---------------- Panggil /api/pay-status ----------------

async function checkPaymentStatus() {
  if (!currentRef || !currentAmount) return;

  try {
    const url =
      `/api/pay-status?reference=${encodeURIComponent(
        currentRef
      )}&amount=${currentAmount}`;

    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    console.log("[pay-status] response:", data);

    if (!res.ok || !data || data.success === false) {
      // Jangan langsung dianggap error fatal, bisa saja rate limit
      return;
    }

    const status =
      (data.data && data.data.status) ||
      data.status ||
      "UNKNOWN";

    const upper = String(status).toUpperCase();

    if (upper === "PAID" || upper === "SUCCESS") {
      setStatus("paid");
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    } else if (upper === "UNPAID" || upper === "PENDING") {
      setStatus("pending", "Menunggu pembayaran...");
    } else {
      setStatus("pending", `Status: ${upper}`);
    }
  } catch (e) {
    console.error("pay-status error:", e);
    // boleh diabaikan, nanti cek lagi di interval berikutnya
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  // cek tiap 3 detik biar nggak terlalu spam
  pollTimer = setInterval(checkPaymentStatus, 3000);
}

// ---------------- Pasang event ----------------

if (btnGenerate) {
  btnGenerate.addEventListener("click", handleCreateQR);
} else {
  console.error("#btn-generate tidak ditemukan");
}

if (amountInput) {
  amountInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleCreateQR();
    }
  });
}

// awal: tampilkan placeholder & status idle
showPlaceholder();
