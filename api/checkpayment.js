import axios from "axios";

const ZENITSU_CONFIG = {
  username: "vinzyy",
  token: "1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const { idTransaksi, amount, createdAt } = req.body;
  const numericAmount = Number(amount);

  if (!idTransaksi || !createdAt || !amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid idTransaksi / amount / createdAt"
    });
  }

  try {
    const response = await axios.post(
      "https://api.zenitsu.web.id/api/orkut/checkpayment",
      {
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token,
        idtrx: idTransaksi,
        amount: numericAmount.toString(),
        createdAt
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000
      }
    );

    if (!response.data) {
      return res.status(500).json({ success: false, error: "Empty response from provider" });
    }

    if (response.data.statusCode === 200 && response.data.results) {
      return res.status(200).json({
        success: true,
        paymentStatus: "Payment successful",
        data: response.data.results
      });
    }

    if (response.data.statusCode === 202) {
      return res.status(200).json({
        success: true,
        paymentStatus: "Waiting for payment",
        data: response.data.results || null
      });
    }

    return res.status(200).json({
      success: true,
      paymentStatus: "Waiting for payment",
      raw: response.data
    });
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    return res.status(status || 500).json({
      success: false,
      error: error.message,
      provider: data || null
    });
  }
}
