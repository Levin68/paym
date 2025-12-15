/* api/orkut.js
 * Vercel Node Serverless Function (single router)
 * Endpoints:
 *  - POST /api/orkut?action=create        { amount, deviceId?, promoCode? }
 *  - GET  /api/orkut?action=qr&idTransaksi=LEVPAY-xxxxx   -> image/png
 *  - GET  /api/orkut?action=status&idTransaksi=...
 *  - POST /api/orkut?action=cancel       { idTransaksi, note? }
 *  - POST /api/orkut?action=callback     { idTransaksi, status, paidAt?, note?, wallet? }
 *
 * Promo:
 *  - POST /api/orkut?action=admin.setPromo   (admin) { code, type, value, expiresAt?, active?, maxUsesTotal?, maxUsesPerDevice? }
 *  - POST /api/orkut?action=admin.deletePromo (admin) { code }
 *  - GET  /api/orkut?action=admin.listPromo   (admin)
 *  - POST /api/orkut?action=promo.apply       { amount, deviceId, code? }
 */

const QRCode = require("qrcode");

// ===================== CORS =====================
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ===================== CONFIG (ENV) =====================
const CONFIG = {
  // QRIS base string (wajib)
  BASE_QR_STRING: (process.env.BASE_QR_STRING || "").trim(),

  // trx expire
  EXPIRE_MINUTES: Number(process.env.EXPIRE_MINUTES || 5),

  // rate limit create
  RL_MAX: Number(process.env.RL_MAX || 3),
  RL_WINDOW_MS: Number(process.env.RL_WINDOW_MS || 5 * 60 * 1000),

  // promo #1 (bulanan per device)
  PROMO1_ENABLED: (process.env.PROMO1_ENABLED || "true") === "true",
  PROMO1_TYPE: process.env.PROMO1_TYPE || "percent", // percent|fixed
  PROMO1_VALUE: Number(process.env.PROMO1_VALUE || 10), // 10% default
  PROMO1_CODE: process.env.PROMO1_CODE || "PROMO_FIRST",

  // github storage
  GH_OWNER: process.env.GITHUB_OWNER || "",
  GH_REPO: process.env.GITHUB_REPO || "",
  GH_BRANCH: process.env.GITHUB_BRANCH || "main",
  GH_PATH: process.env.GITHUB_DB_PATH || "database.json",
  GH_TOKEN: process.env.GITHUB_TOKEN || "",

  // admin
  ADMIN_KEY: process.env.ADMIN_KEY || "", // optional: kalau kosong -> admin endpoint tetap boleh (gak aman)
};

function nowIso() {
  return new Date().toISOString();
}
function addMinutesIso(m) {
  return new Date(Date.now() + m * 60 * 1000).toISOString();
}
function wibTime(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}
function rupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}
function isTerminal(st) {
  return ["paid", "expired", "cancelled", "failed"].includes(String(st || "").toLowerCase());
}
function normalizeCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}
function getProto(req) {
  return (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim() || "https";
}
function getHost(req) {
  return (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
}
function fullBaseUrl(req) {
  const h = getHost(req);
  if (!h) return "";
  return `${getProto(req)}://${h}`;
}
function getClientIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").toString();
  return xf.split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "unknown";
}

function rand5() {
  return String(Math.floor(Math.random() * 100000)).padStart(5, "0");
}
function makeLevpayId(existingMapOrObj) {
  for (let i = 0; i < 30; i++) {
    const id = `LEVPAY-${rand5()}`;
    if (!existingMapOrObj || !existingMapOrObj[id]) return id;
  }
  return `LEVPAY-${String(Date.now()).slice(-5)}`;
}

// ===================== EMV QRIS (TLV + CRC16) =====================
function parseTLV(str) {
  const out = [];
  let i = 0;
  while (i + 4 <= str.length) {
    const tag = str.slice(i, i + 2);
    const lenStr = str.slice(i + 2, i + 4);
    const len = Number(lenStr);
    if (!Number.isFinite(len) || i + 4 + len > str.length) break;
    const value = str.slice(i + 4, i + 4 + len);
    out.push({ tag, value });
    i += 4 + len;
  }
  return out;
}
function buildTLV(items) {
  return items
    .map(({ tag, value }) => {
      const v = String(value);
      const len = String(v.length).padStart(2, "0");
      return `${tag}${len}${v}`;
    })
    .join("");
}
function crc16ccitt(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function generateQrisString(base, amountNumber) {
  const amount = String(amountNumber);
  const items = parseTLV(base).filter((x) => x.tag !== "63"); // remove CRC
  const idx54 = items.findIndex((x) => x.tag === "54");
  if (idx54 >= 0) items[idx54] = { tag: "54", value: amount };
  else {
    const idx53 = items.findIndex((x) => x.tag === "53");
    if (idx53 >= 0) items.splice(idx53 + 1, 0, { tag: "54", value: amount });
    else items.push({ tag: "54", value: amount });
  }
  const noCrc = buildTLV(items) + "6304";
  const crc = crc16ccitt(noCrc);
  return noCrc + crc;
}

// ===================== GitHub DB (database.json) =====================
async function ghRequest(url, opts = {}) {
  const headers = Object.assign(
    {
      "User-Agent": "LevPay-Orkut",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    opts.headers || {}
  );

  if (CONFIG.GH_TOKEN) headers.Authorization = `Bearer ${CONFIG.GH_TOKEN}`;

  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

function b64encode(str) {
  return Buffer.from(str, "utf8").toString("base64");
}
function b64decode(b64) {
  return Buffer.from(b64, "base64").toString("utf8");
}

function emptyDb() {
  return {
    promos: {},         // { CODE: {type,value,expiresAt,active,maxUsesTotal,maxUsesPerDevice} }
    promoUsage: {},     // { "key": number }
    rateLimits: {},     // { "deviceKey": [timestamps...] }
    tx: {},             // { "LEVPAY-xxxxx": { ... } }
  };
}

async function loadDatabase() {
  if (!CONFIG.GH_OWNER || !CONFIG.GH_REPO || !CONFIG.GH_PATH) {
    return { db: emptyDb(), sha: null, note: "github not configured" };
  }

  const url =
    `https://api.github.com/repos/${CONFIG.GH_OWNER}/${CONFIG.GH_REPO}/contents/` +
    `${encodeURIComponent(CONFIG.GH_PATH)}?ref=${encodeURIComponent(CONFIG.GH_BRANCH)}`;

  const { res, json } = await ghRequest(url, { method: "GET" });

  if (res.status === 404) {
    return { db: emptyDb(), sha: null, note: "db file not found (will create)" };
  }
  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || `GitHub GET failed (${res.status})`;
    throw new Error(msg);
  }

  const contentB64 = (json && json.content) || "";
  const sha = (json && json.sha) || null;

  const raw = contentB64 ? b64decode(contentB64.replace(/\n/g, "")) : "{}";
  let db = emptyDb();
  try {
    const parsed = JSON.parse(raw || "{}");
    db = Object.assign(emptyDb(), parsed || {});
    db.promos = db.promos || {};
    db.promoUsage = db.promoUsage || {};
    db.rateLimits = db.rateLimits || {};
    db.tx = db.tx || {};
  } catch {
    db = emptyDb();
  }

  return { db, sha, note: "ok" };
}

async function saveDatabase(db, sha, message) {
  if (!CONFIG.GH_OWNER || !CONFIG.GH_REPO || !CONFIG.GH_PATH) {
    throw new Error("GitHub not configured (set GITHUB_OWNER/REPO/DB_PATH)");
  }
  if (!CONFIG.GH_TOKEN) {
    throw new Error("GITHUB_TOKEN missing (set in Vercel env)");
  }

  const url = `https://api.github.com/repos/${CONFIG.GH_OWNER}/${CONFIG.GH_REPO}/contents/${encodeURIComponent(
    CONFIG.GH_PATH
  )}`;

  const body = {
    message: message || "update database.json",
    content: b64encode(JSON.stringify(db, null, 2)),
    branch: CONFIG.GH_BRANCH,
  };
  if (sha) body.sha = sha;

  const { res, json } = await ghRequest(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || `GitHub PUT failed (${res.status})`;
    throw new Error(msg);
  }

  const newSha = json && json.content && json.content.sha ? json.content.sha : sha;
  return newSha;
}

// ===================== helpers =====================
async function readBody(req) {
  // Vercel biasanya sudah parse json -> req.body object
  if (req.body && typeof req.body === "object") return req.body;
  if (!req.body || typeof req.body !== "string") return {};
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function deny(res, code, msg, extra) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ success: false, error: msg, ...(extra || {}) }));
}

function ok(res, payload) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function isAdmin(req) {
  if (!CONFIG.ADMIN_KEY) return true; // kalau lu gak set, admin endpoint kebuka (ga aman)
  const h = (req.headers["x-admin-key"] || "").toString().trim();
  const auth = (req.headers.authorization || "").toString();
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return h === CONFIG.ADMIN_KEY || bearer === CONFIG.ADMIN_KEY;
}

// ===================== promo logic =====================
function applyDiscount(baseAmount, type, value) {
  const amt = Number(baseAmount);
  const v = Number(value);
  if (!Number.isFinite(amt) || amt < 1) return 1;

  if (type === "percent") {
    const cut = Math.floor((amt * v) / 100);
    return Math.max(1, amt - cut);
  }
  // fixed
  return Math.max(1, amt - v);
}

function monthKeyNow() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function rateLimitCheck(db, deviceKey) {
  const now = Date.now();
  const arr = Array.isArray(db.rateLimits[deviceKey]) ? db.rateLimits[deviceKey] : [];
  const fresh = arr.filter((t) => now - t < CONFIG.RL_WINDOW_MS);

  if (fresh.length >= CONFIG.RL_MAX) {
    db.rateLimits[deviceKey] = fresh;
    const retryAfterSec = Math.ceil((CONFIG.RL_WINDOW_MS - (now - fresh[0])) / 1000);
    return { ok: false, retryAfterSec };
  }

  fresh.push(now);
  db.rateLimits[deviceKey] = fresh;
  return { ok: true, retryAfterSec: 0 };
}

function computeRemainingSeconds(expiredAtIso) {
  const exp = Date.parse(expiredAtIso);
  if (!Number.isFinite(exp)) return 0;
  return Math.max(0, Math.floor((exp - Date.now()) / 1000));
}

// ===================== handler =====================
module.exports = async (req, res) => {
  try {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      return res.end("");
    }

    // sanity
    if (!CONFIG.BASE_QR_STRING) {
      return deny(res, 500, "BASE_QR_STRING missing (set env)");
    }

    const action = (req.query && req.query.action ? String(req.query.action) : "").trim();
    if (!action) return deny(res, 400, "Missing ?action=");

    // quick ping
    if (action === "ping") {
      return ok(res, { ok: true, service: "levpay-orkut", time: nowIso() });
    }

    // load db per request
    const { db, sha: sha0 } = await loadDatabase();
    let sha = sha0;

    // common fields
    db.tx = db.tx || {};
    db.promos = db.promos || {};
    db.promoUsage = db.promoUsage || {};
    db.rateLimits = db.rateLimits || {};

    // ---------- ADMIN: list promo ----------
    if (action === "admin.listPromo") {
      if (!isAdmin(req)) return deny(res, 403, "Admin only");
      const list = Object.entries(db.promos || {}).map(([code, p]) => ({ code, ...p }));
      return ok(res, { success: true, data: { promos: list } });
    }

    // ---------- ADMIN: set promo ----------
    if (action === "admin.setPromo") {
      if (!isAdmin(req)) return deny(res, 403, "Admin only");
      if (req.method !== "POST") return deny(res, 405, "Use POST");

      const body = await readBody(req);
      const code = normalizeCode(body.code);
      const type = String(body.type || "").toLowerCase();
      const value = Number(body.value);

      if (!code) return deny(res, 400, "code required");
      if (!["percent", "fixed"].includes(type)) return deny(res, 400, "type must be percent|fixed");
      if (!Number.isFinite(value) || value <= 0) return deny(res, 400, "value invalid");

      const promo = {
        type,
        value,
        active: body.active == null ? true : !!body.active,
        expiresAt: body.expiresAt ? String(body.expiresAt) : null,
        maxUsesTotal: body.maxUsesTotal == null ? null : Number(body.maxUsesTotal),
        maxUsesPerDevice: body.maxUsesPerDevice == null ? null : Number(body.maxUsesPerDevice),
        note: body.note ? String(body.note) : null,
        updatedAt: nowIso(),
      };

      db.promos[code] = promo;
      sha = await saveDatabase(db, sha, `admin.setPromo ${code}`);

      return ok(res, { success: true, data: { code, promo } });
    }

    // ---------- ADMIN: delete promo ----------
    if (action === "admin.deletePromo") {
      if (!isAdmin(req)) return deny(res, 403, "Admin only");
      if (req.method !== "POST") return deny(res, 405, "Use POST");

      const body = await readBody(req);
      const code = normalizeCode(body.code);
      if (!code) return deny(res, 400, "code required");

      delete db.promos[code];
      sha = await saveDatabase(db, sha, `admin.deletePromo ${code}`);

      return ok(res, { success: true, data: { code, deleted: true } });
    }

    // ---------- PROMO: apply (nyambung #1 & #2) ----------
    if (action === "promo.apply") {
      if (req.method !== "POST") return deny(res, 405, "Use POST");
      const body = await readBody(req);

      const deviceId = String(body.deviceId || "").trim() || "unknown";
      const amount = Number(body.amount);
      const codeInput = String(body.code || "").trim();

      if (!Number.isFinite(amount) || amount < 1) return deny(res, 400, "amount invalid");

      // #1 monthly-first (auto jika code kosong)
      if (!codeInput && CONFIG.PROMO1_ENABLED) {
        const mKey = monthKeyNow();
        const firstKey = `first:${deviceId}:${mKey}`;
        const firstUsed = Number(db.promoUsage[firstKey] || 0) > 0;

        if (!firstUsed) {
          const finalAmount = applyDiscount(amount, CONFIG.PROMO1_TYPE, CONFIG.PROMO1_VALUE);
          db.promoUsage[firstKey] = 1;
          sha = await saveDatabase(db, sha, `promo.apply #1 ${deviceId} ${mKey}`);

          return ok(res, {
            success: true,
            data: {
              amount,
              finalAmount,
              applied: {
                code: CONFIG.PROMO1_CODE,
                type: CONFIG.PROMO1_TYPE,
                value: CONFIG.PROMO1_VALUE,
                mode: "#1-monthly-first",
              },
            },
          });
        }

        return ok(res, { success: true, data: { amount, finalAmount: amount, applied: null } });
      }

      // #2 custom code
      const code = normalizeCode(codeInput);
      const promo = db.promos[code];
      if (!promo) return deny(res, 404, "promo not found");
      if (!promo.active) return deny(res, 400, "promo inactive");

      if (promo.expiresAt) {
        const exp = Date.parse(promo.expiresAt);
        if (Number.isFinite(exp) && Date.now() > exp) return deny(res, 400, "promo expired");
      }

      const totalKey = `total:${code}`;
      const devKey = `dev:${code}:${deviceId}`;
      const totalUsed = Number(db.promoUsage[totalKey] || 0);
      const devUsed = Number(db.promoUsage[devKey] || 0);

      if (promo.maxUsesTotal != null && totalUsed >= promo.maxUsesTotal) return deny(res, 400, "promo maxUsesTotal reached");
      if (promo.maxUsesPerDevice != null && devUsed >= promo.maxUsesPerDevice) return deny(res, 400, "promo maxUsesPerDevice reached");

      const finalAmount = applyDiscount(amount, promo.type, promo.value);

      db.promoUsage[totalKey] = totalUsed + 1;
      db.promoUsage[devKey] = devUsed + 1;
      sha = await saveDatabase(db, sha, `promo.apply #2 ${code} ${deviceId}`);

      return ok(res, {
        success: true,
        data: {
          amount,
          finalAmount,
          applied: { code, type: promo.type, value: promo.value, mode: "#2-custom" },
        },
      });
    }

    // ---------- CREATE QR ----------
    if (action === "create") {
      if (req.method !== "POST") return deny(res, 405, "Use POST");

      const body = await readBody(req);
      const amountRaw = Number(body.amount);
      if (!Number.isFinite(amountRaw) || amountRaw < 1) return deny(res, 400, "amount invalid");

      const deviceId = String(body.deviceId || "").trim();
      const deviceKey = deviceId || `ip:${getClientIp(req)}`;

      // rate limit: 3 create / 5 menit / device
      const rl = rateLimitCheck(db, deviceKey);
      if (!rl.ok) {
        sha = await saveDatabase(db, sha, `rateLimit hit ${deviceKey}`);
        return deny(res, 429, `Rate limit: max ${CONFIG.RL_MAX} create / 5 menit`, { retryAfterSec: rl.retryAfterSec });
      }

      // optional promo apply on create (auto #1 if no promoCode)
      const promoCode = String(body.promoCode || "").trim();
      let finalAmount = amountRaw;
      let appliedPromo = null;

      // try auto promo #1 if no promoCode
      if (!promoCode && CONFIG.PROMO1_ENABLED) {
        const mKey = monthKeyNow();
        const firstKey = `first:${deviceKey}:${mKey}`;
        const firstUsed = Number(db.promoUsage[firstKey] || 0) > 0;
        if (!firstUsed) {
          finalAmount = applyDiscount(amountRaw, CONFIG.PROMO1_TYPE, CONFIG.PROMO1_VALUE);
          appliedPromo = { code: CONFIG.PROMO1_CODE, type: CONFIG.PROMO1_TYPE, value: CONFIG.PROMO1_VALUE, mode: "#1-monthly-first" };
          db.promoUsage[firstKey] = 1;
        }
      }

      // if promoCode present -> apply promo #2
      if (promoCode) {
        const code = normalizeCode(promoCode);
        const promo = db.promos[code];
        if (!promo) return deny(res, 404, "promo not found");
        if (!promo.active) return deny(res, 400, "promo inactive");

        if (promo.expiresAt) {
          const exp = Date.parse(promo.expiresAt);
          if (Number.isFinite(exp) && Date.now() > exp) return deny(res, 400, "promo expired");
        }

        const totalKey = `total:${code}`;
        const devKey = `dev:${code}:${deviceKey}`;
        const totalUsed = Number(db.promoUsage[totalKey] || 0);
        const devUsed = Number(db.promoUsage[devKey] || 0);

        if (promo.maxUsesTotal != null && totalUsed >= promo.maxUsesTotal) return deny(res, 400, "promo maxUsesTotal reached");
        if (promo.maxUsesPerDevice != null && devUsed >= promo.maxUsesPerDevice) return deny(res, 400, "promo maxUsesPerDevice reached");

        finalAmount = applyDiscount(amountRaw, promo.type, promo.value);
        appliedPromo = { code, type: promo.type, value: promo.value, mode: "#2-custom" };

        db.promoUsage[totalKey] = totalUsed + 1;
        db.promoUsage[devKey] = devUsed + 1;
      }

      const idTransaksi = makeLevpayId(db.tx);
      const createdAt = nowIso();
      const expiredAt = addMinutesIso(CONFIG.EXPIRE_MINUTES);

      db.tx[idTransaksi] = {
        idTransaksi,
        amount: finalAmount,
        originalAmount: amountRaw,
        appliedPromo,
        deviceKey,
        ip: getClientIp(req),

        status: "pending",
        createdAt,
        expiredAt,
        paidAt: null,
        note: null,
        wallet: null, // VPS bisa isi (DANA/OVO/GOPAY/dll)
        lastUpdateAt: createdAt,
      };

      sha = await saveDatabase(db, sha, `create ${idTransaksi}`);

      const base = fullBaseUrl(req);
      const qrUrl = `${base}/api/orkut?action=qr&idTransaksi=${encodeURIComponent(idTransaksi)}`;

      return ok(res, {
        success: true,
        data: {
          idTransaksi,
          amount: finalAmount,
          originalAmount: amountRaw,
          appliedPromo,
          createdAt,
          expiredAt,
          status: "pending",
          qrUrl, // FULL URL
        },
      });
    }

    // ---------- QR PNG ----------
    if (action === "qr") {
      if (req.method !== "GET") return deny(res, 405, "Use GET");

      const id = (req.query && req.query.idTransaksi ? String(req.query.idTransaksi) : "").trim();
      if (!id) return deny(res, 400, "idTransaksi required");

      const rec = db.tx[id];
      if (!rec) return deny(res, 404, "not found");

      // auto mark expired (persist)
      if (rec.status === "pending" && Date.now() > Date.parse(rec.expiredAt)) {
        rec.status = "expired";
        rec.note = rec.note || "auto-expired";
        rec.lastUpdateAt = nowIso();
        db.tx[id] = rec;
        sha = await saveDatabase(db, sha, `expired ${id}`);
      }

      // generate QR image on the fly (no tmp)
      const qrisString = generateQrisString(CONFIG.BASE_QR_STRING, Number(rec.amount));

      const png = await QRCode.toBuffer(qrisString, {
        type: "png",
        width: 720,
        margin: 1,
        errorCorrectionLevel: "M",
      });

      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return res.end(png);
    }

    // ---------- STATUS ----------
    if (action === "status") {
      if (req.method !== "GET") return deny(res, 405, "Use GET");

      const id = (req.query && req.query.idTransaksi ? String(req.query.idTransaksi) : "").trim();
      if (!id) return deny(res, 400, "idTransaksi required");

      const rec = db.tx[id];
      if (!rec) return deny(res, 404, "not found");

      // auto expire (persist)
      if (rec.status === "pending" && Date.now() > Date.parse(rec.expiredAt)) {
        rec.status = "expired";
        rec.note = rec.note || "auto-expired";
        rec.lastUpdateAt = nowIso();
        db.tx[id] = rec;
        sha = await saveDatabase(db, sha, `expired ${id}`);
      }

      const remainingSeconds = computeRemainingSeconds(rec.expiredAt);
      const terminal = isTerminal(rec.status);

      return ok(res, {
        success: true,
        data: {
          idTransaksi: rec.idTransaksi,
          amount: rec.amount,
          originalAmount: rec.originalAmount || rec.amount,
          appliedPromo: rec.appliedPromo || null,

          status: rec.status,
          paidAt: rec.paidAt,
          wallet: rec.wallet || null,
          note: rec.note || null,

          createdAt: rec.createdAt,
          expiredAt: rec.expiredAt,
          remainingSeconds,
          terminal,
          lastUpdateAt: rec.lastUpdateAt,

          qrUrl: `${fullBaseUrl(req)}/api/orkut?action=qr&idTransaksi=${encodeURIComponent(rec.idTransaksi)}`,
        },
      });
    }

    // ---------- CANCEL ----------
    if (action === "cancel") {
      if (req.method !== "POST") return deny(res, 405, "Use POST");
      const body = await readBody(req);

      const id = String(body.idTransaksi || "").trim();
      if (!id) return deny(res, 400, "idTransaksi required");

      const rec = db.tx[id];
      if (!rec) return deny(res, 404, "not found");

      if (!isTerminal(rec.status)) {
        rec.status = "cancelled";
        rec.note = body.note ? String(body.note) : "cancelled";
        rec.lastUpdateAt = nowIso();
        db.tx[id] = rec;
        sha = await saveDatabase(db, sha, `cancel ${id}`);
      }

      return ok(res, { success: true, data: { idTransaksi: id, status: db.tx[id].status } });
    }

    // ---------- CALLBACK from VPS ----------
    if (action === "callback") {
      if (req.method !== "POST") return deny(res, 405, "Use POST");
      const body = await readBody(req);

      const id = String(body.idTransaksi || "").trim();
      const statusIn = String(body.status || "").trim().toLowerCase();
      const note = body.note ? String(body.note) : null;
      const paidAt = body.paidAt ? String(body.paidAt) : null;
      const wallet = body.wallet ? String(body.wallet) : null; // contoh: "DANA"

      if (!id || !statusIn) return deny(res, 400, "idTransaksi & status required");

      const rec = db.tx[id];
      if (!rec) return deny(res, 404, "not found");

      const allowed = new Set(["pending", "paid", "expired", "cancelled", "failed"]);
      if (!allowed.has(statusIn)) return deny(res, 400, "invalid status");

      // update
      rec.status = statusIn;
      rec.note = note || rec.note || null;
      if (wallet) rec.wallet = wallet;
      if (statusIn === "paid") rec.paidAt = paidAt || nowIso();
      rec.lastUpdateAt = nowIso();

      db.tx[id] = rec;
      sha = await saveDatabase(db, sha, `callback ${statusIn} ${id}`);

      return ok(res, {
        success: true,
        data: {
          idTransaksi: id,
          status: rec.status,
          paidAt: rec.paidAt || null,
          wallet: rec.wallet || null,
          note: rec.note || null,
        },
      });
    }

    return deny(res, 404, "Unknown action");
  } catch (e) {
    return deny(res, 500, e && e.message ? e.message : "Server error");
  }
};