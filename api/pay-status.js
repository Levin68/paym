module.exports = async (req, res) => {
  const reference = req.query.reference || req.body.reference;
  const amount = req.query.amount || req.body.amount;

  try {
    const status = await checkPaymentStatus(reference, amount);
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
