// api/debug-saldo.js

const _norm = (m) => (m && (m.default || m)) || m;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const auth_username = process.env.ORKUT_AUTH_USERNAME;
  const auth_token = process.env.ORKUT_AUTH_TOKEN;

  if (!auth_username || !auth_token) {
    return res.status(500).json({
      success: false,
      error: 'ENV ORKUT_AUTH_USERNAME / ORKUT_AUTH_TOKEN belum di-set'
    });
  }

  let PaymentChecker;
  try {
    const mod = require('autoft-qris/src/payment-checker.cjs');
    PaymentChecker = _norm(mod.PaymentChecker || mod);
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: 'Gagal load PaymentChecker CJS',
      detail: String(e.message || e)
    });
  }

  try {
    const checker = new PaymentChecker({ auth_username, auth_token });
    const saldo = await checker.checkSaldo();   // fungsi bawaan lib
    return res.status(200).json({ success: true, raw: saldo });
  } catch (e) {
    return res.status(200).json({
      success: false,
      error: 'Gagal cek saldo / auth ke OrderKuota',
      detail: String(e.message || e)
    });
  }
};
