// api/pay-status.js

module.exports = (req, res) => {
  const { reference, amount } = req.query || {};

  return res.status(200).json({
    success: true,
    data: {
      reference: reference || null,
      amount: amount ? Number(amount) : null,
      status: 'UNPAID'     // nanti kalau mau, ganti ke real checker
    }
  });
};
