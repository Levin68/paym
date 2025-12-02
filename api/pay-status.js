// api/pay-status.js

// ---------- util ----------
const _norm = (m) => (m && (m.default || m)) || m;

function ok(res, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(body);
}
function fail(res, code, stage, message, extra = {}) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json({ success: false, stage, message, ...extra });
}

// ---------- 1) Loader PaymentChecker: ESM & CJS ----------
let PCPromise = null;
let lastLoadErr = null;

async function getPaymentChecker() {
  if (PCPromise) return PCPromise;
  PCPromise = (async () => {
    try {
      // ESM path (src)
      try {
        const m1 = await import('autoft-qris/src/payment-checker.mjs');
        const C1 = _norm(m1.PaymentChecker || m1);
        if (C1) return C1;
      } catch (e1) { lastLoadErr = e1; }

      // ESM path (root)
      try {
        const m2 = await import('autoft-qris/payment-checker.mjs');
        const C2 = _norm(m2.PaymentChecker || m2);
        if (C2) return C2;
      } catch (e2) { lastLoadErr = e2; }

      // CJS fallback
      try {
        const c = require('autoft-qris');
        const C3 = c.PaymentChecker || require('autoft-qris/src/payment-checker.cjs');
        if (C3) return C3;
      } catch (e3) { lastLoadErr = e3; }

      throw lastLoadErr || new Error('PaymentChecker tidak ditemukan');
    } catch (e) {
      lastLoadErr = e;
      throw e;
    }
  })();
  return PCPromise;
}

// ---------- 2) ENV config ----------
const CONFIG = {
  auth_username: process.env.ORKUT_AUTH_USERNAME,
  auth_token: process.env.ORKUT_AUTH_TOKEN,
};

// ---------- 3) Normalizer super-aman ----------
function normalizeResult(res) {
  // jika res bukan object, langsung UNKNOWN
  if (!res || typeof res !== 'object') {
    return { status: 'UNKNOWN', amount: 0, ref: '', paidAt: null, raw: res };
  }
  // ambil payload umum
  let data = res.data ?? res.result ?? res;
  if (Array.isArray(data)) data = data[0] ?? {};
  if (!data || typeof data !== 'object') data = {};

  const statusRaw = [
    data.status,
    data.payment_status,
    data.transaction_status
  ].find(Boolean);

  const amountRaw = data.amount ?? data.gross_amount ?? data.total ?? data.nominal;
  const refRaw = data.ref ?? data.reference ?? data.order_id ?? data.transaction_id;
  const paidAtRaw = data.date ?? data.paid_at ?? data.paidAt ?? data.transaction_time ?? data.settled_at;

  const status = (statusRaw ? String(statusRaw) : 'UNKNOWN').toUpperCase();
  const amount = Number(amountRaw ?? 0);
  const ref = refRaw ? String(refRaw) : '';
  const paidAt = paidAtRaw ?? null;

  return { status, amount, ref, paidAt, raw: res };
}

// ---------- 4) Handler Vercel ----------
module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return fail(res, 405, 'method', 'Gunakan GET/POST');
    }

    // parse input
    let reference = '';
    let amount = 0;
    try {
      if (req.method === 'GET') {
        reference = String(req.query.reference ?? '').trim();
        amount = Number(req.query.amount ?? 0);
      } else {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        reference = String(body.reference ?? '').trim();
        amount = Number(body.amount ?? 0);
      }
    } catch {
      return fail(res, 400, 'parse', 'Body / query tidak valid');
    }

    if (!reference) return fail(res, 400, 'validate', 'reference wajib diisi');
    if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, 'validate', 'amount tidak valid');

    if (!CONFIG.auth_username || !CONFIG.auth_token) {
      return fail(res, 500, 'config', 'ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set di ENV');
    }

    // load PaymentChecker
    let PaymentChecker;
    try {
      PaymentChecker = await getPaymentChecker();
    } catch (e) {
      return fail(res, 500, 'load-payment-checker', 'PaymentChecker tidak bisa diload dari autoft-qris', { detail: String(e?.message || e) });
    }

    // single check (NO polling di serverless)
    let raw;
    try {
      const checker = new PaymentChecker({
        auth_token: CONFIG.auth_token,
        auth_username: CONFIG.auth_username,
      });
      raw = await checker.checkPaymentStatus(reference, amount);
    } catch (e) {
      return fail(res, 502, 'upstream', 'Gagal memanggil API penyedia', { detail: String(e?.message || e) });
    }

    const norm = normalizeResult(raw);

    // optional: ketatkan paid status
    const PAID = new Set(['PAID', 'SUCCESS', 'COMPLETED', 'SETTLEMENT', 'CAPTURE', 'CONFIRMED', 'SUCCESSFUL', 'PAID_OFF', 'DONE']);
    const amountOK = Math.abs(Math.round(norm.amount || 0) - Math.round(amount)) <= 100; // tolerance Rp100
    const isPaid = PAID.has(norm.status) && amountOK;

    return ok(res, {
      success: true,
      data: {
        reference,
        requested_amount: amount,
        provider_amount: Number(norm.amount || 0),
        amount_match: amountOK,
        status: norm.status,
        isPaid,
        paidAt: norm.paidAt || null,
      },
      raw: norm.raw, // untuk debugging di logs/FE
    });
  } catch (err) {
    console.error('[pay-status] fatal:', err);
    return fail(res, 500, 'fatal', err?.message || 'Internal server error');
  }
};
