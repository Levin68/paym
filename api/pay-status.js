// api/check-payment.js
module.exports = (req, res) => {
  return res.status(200).json({
    hello: true,
    method: req.method,
    message: "CHECK PAYMENT ENDPOINT HIDUP"
  });
};    });

    // call bener-bener sama kayak di bot: (ref, amount)
    const result = await checker.checkPaymentStatus(reference, numericAmount);

    // biasanya bentuknya { success, data, message }
    return res.status(200).json(result);
  } catch (err) {
    console.error('[check-payment] error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal cek status pembayaran: ' + err.message
    });
  }
};
