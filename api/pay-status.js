// api/pay-status.js

// cache class supaya nggak import berkali-kali
let PaymentCheckerClass = null;

async function getPaymentChecker() {
  if (!PaymentCheckerClass) {
    const m = await import('autoft-qris/src/payment-checker.mjs');
    PaymentCheckerClass = m.default || m.PaymentChecker;
  }
  return new PaymentCheckerClass({
    auth_token: process.env.ORKUT_AUTH_TOKEN,
    auth_username: process.env.ORKUT_AUTH_USERNAME
  });
}

// ambil pola dari kode bot WA kamu, tapi dipangkas
function normalizeCheckerResult(res) {
  if (!res || typeof res !== 'object') return null;
  if (res.success === false || res.error) return null;

  let data = res.data || res.result || res;
  if (Array.isArray(data)) data = data[0] || {};
  if (!data || typeof data !== 'object') return null;

  const status = (
    data.status ||
    data.payment_status ||
    data.transaction_status ||
    ''
  )
    .toString()
    .toUpperCase();

  const amount = Number(
    data.amount ||
    data.gross_amount ||
    data.total ||
    data.nominal ||
    0
  );

  const ref = (
    data.ref ||
    data.reference ||
    data.order_id ||
    data.transaction_id ||
    ''
  )
    .toString()
    .trim();

  const paidAt =
    data.date ||
    data.paid_at ||
    data.paidAt ||
    data.transaction_time ||
    data.settled_at ||
    null;

  return { status, amount, ref, paidAt, raw: data };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { ref, amount } = req.query;

    if (!ref) {
      return res
        .status(400)
        .json({ success: false, message: 'ref wajib diisi' });
    }

    const checker = await getPaymentChecker();
    const nominal = amount ? Number(amount) : undefined;
    const rawResult = await checker.checkPaymentStatus(ref, nominal);

    const n = normalizeCheckerResult(rawResult);

    if (!n) {
      // respon nggak kebaca, lempar balik buat debug
      return res.status(200).json({
        success: false,
        message: 'Response payment tidak bisa dinormalisasi',
        raw: rawResult
      });
    }

    // inilah bentuk final yang bakal dibaca frontend
    return res.status(200).json({
      success: true,
      data: n
    });
  } catch (err) {
    console.error('pay-status error:', err);
    return res.status(500).json({
      success: false,
      stage: 'handler',
      message: err.message || 'Internal server error',
      stack: err.stack
    });
  }
};
