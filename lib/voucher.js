// lib/voucher.js
const crypto = require("crypto");

function nowIso() { return new Date().toISOString(); }

function monthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s || ""), "utf8").digest("hex");
}

function deviceKeyFrom(deviceIdOrIp) {
  const pepper = process.env.DEVICE_PEPPER || ""; // optional
  return sha256(`${pepper}|${deviceIdOrIp || "unknown"}`).slice(0, 32);
}

// promo #1: first per device per month
function applyMonthlyPromo(db, deviceKey, amount) {
  const enabled = String(process.env.PROMO1_ENABLED || "true") === "true";
  const percent = Number(process.env.PROMO1_PERCENT || 10); // default 10%
  if (!enabled) return null;

  const mk = monthKey();
  db.devices[deviceKey] = db.devices[deviceKey] || { monthlyUsed: {} };

  const used = !!db.devices[deviceKey].monthlyUsed?.[mk];
  if (used) return null;

  const disc = Math.floor((amount * percent) / 100);
  const pay = Math.max(1, amount - disc);

  db.devices[deviceKey].monthlyUsed[mk] = true;

  return {
    type: "MONTHLY_FIRST",
    code: "PROMO1",
    percent,
    discountAmount: disc,
    payAmount: pay,
  };
}

// promo #2: custom code
function applyCustomPromo(db, deviceKey, amount, codeRaw) {
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code) return null;

  const p = db.promos?.[code];
  if (!p || p.enabled === false) return null;

  const expiresAt = p.expiresAt ? Date.parse(p.expiresAt) : 0;
  if (expiresAt && Date.now() > expiresAt) return null;

  const maxUses = Number(p.maxUses || 0);
  const usedCount = Number(p.usedCount || 0);
  if (maxUses > 0 && usedCount >= maxUses) return null;

  // per device 1x
  db.redemptions[code] = db.redemptions[code] || {};
  if (db.redemptions[code][deviceKey]) return null;

  const percent = Number(p.percent || 0);
  if (!(percent > 0 && percent <= 100)) return null;

  const disc = Math.floor((amount * percent) / 100);
  const pay = Math.max(1, amount - disc);

  db.redemptions[code][deviceKey] = true;
  p.usedCount = usedCount + 1;
  db.promos[code] = p;

  return {
    type: "CUSTOM",
    code,
    percent,
    discountAmount: disc,
    payAmount: pay,
    expiresAt: p.expiresAt || null,
  };
}

function applyVoucher(db, deviceIdOrIp, amount, promoCode) {
  db.promos = db.promos || {};
  db.devices = db.devices || {};
  db.redemptions = db.redemptions || {};
  db.transactions = db.transactions || {};

  const dk = deviceKeyFrom(deviceIdOrIp);

  // prioritas: custom dulu (biar promo manual gak ketiban promo bulanan)
  const custom = applyCustomPromo(db, dk, amount, promoCode);
  if (custom) return { deviceKey: dk, applied: custom };

  const monthly = applyMonthlyPromo(db, dk, amount);
  if (monthly) return { deviceKey: dk, applied: monthly };

  return { deviceKey: dk, applied: null };
}

// admin upsert promo
function adminUpsertPromo(db, body) {
  const code = String(body?.code || "").trim().toUpperCase();
  const percent = Number(body?.percent);
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt).toISOString() : null;
  const maxUses = Number(body?.maxUses || 0);

  if (!code || !Number.isFinite(percent) || percent <= 0 || percent > 100) {
    throw new Error("invalid promo input (code/percent)");
  }

  db.promos = db.promos || {};
  db.promos[code] = {
    code,
    percent,
    expiresAt,
    maxUses,
    usedCount: Number(db.promos?.[code]?.usedCount || 0),
    enabled: body?.enabled === false ? false : true,
    updatedAt: nowIso(),
  };

  return db.promos[code];
}

module.exports = {
  deviceKeyFrom,
  applyVoucher,
  adminUpsertPromo,
};
