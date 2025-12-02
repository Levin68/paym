const _norm = (m) => (m && (m.default || m)) || m;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Gunakan GET atau POST',
    });
  }

  let reference = '';
  let amount = 0;

  try {
    if (req.method === 'GET') {
      reference = String(req.query.reference || '').trim();
      amount = Number(req.query.amount || 0);
    } else {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      reference = String(body.reference || '').trim();
      amount = Number(body.amount || 0);
    }
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: 'Body / query tidak valid',
      raw: { error: e.message },
    });
  }

  if (!reference || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Parameter reference/amount tidak valid',
    });
  }

  // --- Load PaymentChecker CJS ---
  let PaymentChecker;
  try {
    const mod = require('autoft-qris/src/payment-checker.cjs');
    PaymentChecker = _norm(mod.PaymentChecker || mod);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Gagal load PaymentChecker dari autoft-qris',
      raw: { error: err.message },
    });
  }

  // --- ENV check ---
  const username = process.env.ORKUT_AUTH_USERNAME;
  const token = process.env.ORKUT_AUTH_TOKEN;

  if (!username || !token) {
    return res.status(500).json({
      success: false,
      message: 'ENV ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set',
    });
  }

  // --- Check status pembayaran ---
  let raw;
  try {
    const checker = new PaymentChecker({
      auth_username: username,
      auth_token: token,
    });

    if (typeof checker.checkPaymentStatus !== 'function') {
      throw new Error('Method checkPaymentStatus() tidak ditemukan');
    }

    raw = await checker.checkPaymentStatus(reference, amount);
  } catch (e) {
    raw = {
      success: false,
      error: 'Gagal cek status pembayaran: ' + String(e.message || e),
    };
  }

  const status = raw?.data?.status?.toUpperCase?.() || 'UNKNOWN';

  return res.status(200).json({
    success: true,
    reference,
    amount,
    status,
    raw,
  });
};
