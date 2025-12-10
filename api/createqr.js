// /api/createqr.js
import axios from "axios";

const ZENITSU_CONFIG = {
  username: "vinzyy",
  token: "1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method Not Allowed" });
  }

  const { amount } = req.body;
  const numericAmount = Number(amount);

  // amount bebas (1–100000000), yang penting angka > 0
  if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid amount" });
  }

  try {
    const response = await axios.post(
      "https://api.zenitsu.web.id/api/orkut/createqr",
      {
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token,
        amount: numericAmount.toString(),
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    if (
      !response.data ||
      response.data.statusCode !== 200 ||
      !response.data.results
    ) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to generate QR" });
    }

    const r = response.data.results;

    return res.status(200).json({
      success: true,
      data: {
        idTransaksi: r.idtrx,
        amount: Number(r.amount),
        createdAt: r.createAt,
        expired: r.expired,
        qrUrl: r.url,
      },
    });
  } catch (err) {
    console.error("Error createqr:", err.message);
    return res
      .status(500)
      .json({ success: false, error: err.message });
  }
}
