// api/pay-status.js

module.exports = (req, res) => {
  res.status(200).json({
    success: true,
    message: "PAY STATUS OK",
    method: req.method,
    query: req.query
  });
};
