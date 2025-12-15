// lib/voucher.js
function monthKey(d = new Date()) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function clamp(n, a, b) {
  n = Number(n || 0);
  return Math.max(a, Math.min(b, n));
}

function applyPercentDiscount(amount, percent, cap) {
  const a = Math.max(0, Number(amount || 0));
  const p = clamp(percent, 0, 100);
  let disc = Math.floor((a * p) / 100);
  if (Number.isFinite(cap) && cap > 0) disc = Math.min(disc, cap);
  const finalAmount = Math.max(1, a - disc);
  return { discount: disc, finalAmount };
}

// ===== Promo Config (boleh ubah) =====
const PROMO1 = {
  percent: Number(process.env.PROMO1_PERCENT || 5), // default 10%
  cap: Number(process.env.PROMO1_CAP || 5000),       // max diskon Rp5.000
};

function ensureDevice(db, deviceId) {
  db.devices = db.devices || {};
  if (!db.devices[deviceId]) {
    db.devices[deviceId] = { createdAt: new Date().toISOString(), monthly: {} };
  }
  db.devices[deviceId].monthly = db.devices[deviceId].monthly || {};
  return db.devices[deviceId];
}

// ===== Promo #1: first trx per month =====
function tryPromo1(db, deviceId, amount) {
  if (!deviceId) return { ok: false, reason: "no-deviceId" };

  const dev = ensureDevice(db, deviceId);
  const mk = monthKey();
  const m = dev.monthly[mk] || { promo1Used: false };
  dev.monthly[mk] = m;

  if (m.promo1Used) return { ok: false, reason: "promo1-already-used" };

  const { discount, finalAmount } = applyPercentDiscount(amount, PROMO1.percent, PROMO1.cap);

  m.promo1Used = true;
  m.lastUsedAt = new Date().toISOString();

  return {
    ok: true,
    promo: "PROMO1_MONTHLY_FIRST",
    discount,
    finalAmount,
  };
}

// ===== Promo #2: custom code =====
function tryPromo2(db, codeRaw, amount) {
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code) return { ok: false, reason: "empty-code" };

  db.promo2 = db.promo2 || { codes: {} };
  db.promo2.codes = db.promo2.codes || {};

  const item = db.promo2.codes[code];
  if (!item) return { ok: false, reason: "code-not-found" };
  if (item.enabled === false) return { ok: false, reason: "code-disabled" };

  const now = Date.now();
  const exp = item.expiresAt ? Date.parse(item.expiresAt) : 0;
  if (exp && now > exp) return { ok: false, reason: "code-expired" };

  const maxUses = Number(item.maxUses || 0);
  const used = Number(item.used || 0);
  if (maxUses > 0 && used >= maxUses) return { ok: false, reason: "code-usage-max" };

  const percent = Number(item.percent || 0);
  const cap = Number(item.cap || 0) || undefined;

  const { discount, finalAmount } = applyPercentDiscount(amount, percent, cap);

  item.used = used + 1;
  item.lastUsedAt = new Date().toISOString();
  db.promo2.codes[code] = item;

  return {
    ok: true,
    promo: "PROMO2_CODE",
    promoCode: code,
    discount,
    finalAmount,
  };
}

// ===== Admin set promo2 =====
function adminUpsertPromo2(db, payload) {
  const code = String(payload?.code || "").trim().toUpperCase();
  if (!code) throw new Error("code wajib");

  const percent = clamp(payload?.percent, 1, 100);
  const expiresAt = payload?.expiresAt ? String(payload.expiresAt) : null;

  db.promo2 = db.promo2 || { codes: {} };
  db.promo2.codes = db.promo2.codes || {};

  db.promo2.codes[code] = {
    code,
    percent,
    cap: payload?.cap ? Number(payload.cap) : 0,
    expiresAt,
    maxUses: payload?.maxUses ? Number(payload.maxUses) : 0,
    used: payload?.resetUsed ? 0 : Number(db.promo2.codes?.[code]?.used || 0),
    enabled: payload?.enabled !== false,
    updatedAt: new Date().toISOString(),
  };

  return db.promo2.codes[code];
}

module.exports = {
  tryPromo1,
  tryPromo2,
  adminUpsertPromo2,
};
