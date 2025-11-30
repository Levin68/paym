// api/check-payment.js

module.exports = async (req, res) => {
  console.log('[check-payment] request', req.method, req.query);

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan GET.'
    });
  }

  const { reference, amount } = req.query;

  if (!reference || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Parameter reference dan amount wajib diisi.'
    });
  }

  const { ORKUT_AUTH_USERNAME, ORKUT_AUTH_TOKEN } = process.env;

  if (!ORKUT_AUTH_USERNAME || !ORKUT_AUTH_TOKEN) {
    return res.status(500).json({
      success: false,
      message:
        'ENV ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum diset di Vercel.'
    });
  }

  let PaymentChecker;

  // --- coba require (CommonJS) dulu ---
  try {
    const cjs = require('autoft-qris');
    console.log('[check-payment] require(autoft-qris) keys:', Object.keys(cjs));

    PaymentChecker =
      cjs.PaymentChecker ||
      (cjs.default && cjs.default.PaymentChecker) ||
      cjs.default;

  } catch (requireErr) {
    console.log('[check-payment] require gagal, coba import...', requireErr);

    // --- kalau require gagal, fallback ke dynamic import (ESM) ---
    try {
      const mod = await import('autoft-qris');
      console.log('[check-payment] import(autoft-qris) keys:', Object.keys(mod));

      PaymentChecker =
        mod.PaymentChecker ||
        (mod.default && mod.default.PaymentChecker) ||
        mod.default;
    } catch (importErr) {
      console.error('[check-payment] import juga gagal:', importErr);
      return res.status(500).json({
        success: false,
        message:
          'Server gagal load PaymentChecker dari autoft-qris: ' +
          importErr.message
      });
    }
  }

  if (typeof PaymentChecker !== 'function') {
    console.error('[check-payment] PaymentChecker bukan function/class:', PaymentChecker);
    return res.status(500).json({
      success: false,
      message: 'PaymentChecker dari autoft-qris tidak ditemukan.'
    });
  }

  try {
    const checker = new PaymentChecker({
      auth_token: ORKUT_AUTH_TOKEN,
      auth_username: ORKUT_AUTH_USERNAME
    });

    const result = await checker.checkPaymentStatus(
      reference,
      Number(amount)
    );

    console.log('[check-payment] result:', result);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[check-payment] error saat checkPaymentStatus:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal cek status pembayaran: ' + err.message
    });
  }
};
