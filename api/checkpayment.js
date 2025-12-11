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

    const data = response.data;

    // Log untuk debugging
    console.log("[CHECKPAYMENT]", {
      idTransaksi,
      statusCode: data?.statusCode,
      results: data?.results
    });

    if (!data) {
      return res.status(500).json({ 
        success: false, 
        error: "Empty response from provider" 
      });
    }

    // Validasi ketat untuk status PAID
    if (data.statusCode === 200 && data.results) {
      const results = data.results;
      
      // Pastikan ada bukti pembayaran
      const isPaid = 
        results.status === "success" ||
        results.paid === true ||
        results.paidAt ||
        results.settlementTime;

      if (isPaid) {
        return res.status(200).json({
          success: true,
          paymentStatus: "Payment successful",
          data: {
            ...results,
            paidAt: results.paidAt || results.settlementTime || new Date().toISOString()
          }
        });
      } else {
        // Status 200 tapi ga ada bukti paid - treat as pending
        console.warn("[CHECKPAYMENT-SUSPICIOUS]", {
          idTransaksi,
          message: "Status 200 but no payment proof",
          results
        });
        
        return res.status(200).json({
          success: true,
          paymentStatus: "Waiting for payment",
          data: results,
          warning: "Status unclear"
        });
      }
    }

    if (data.statusCode === 202) {
      return res.status(200).json({
        success: true,
        paymentStatus: "Waiting for payment",
        data: data.results || null
      });
    }

    // Status lainnya
    return res.status(200).json({
      success: true,
      paymentStatus: "Waiting for payment",
      raw: data
    });
  } catch (error) {
    console.error("[CHECKPAYMENT-ERROR]", {
      idTransaksi,
      error: error.message
    });

    const status = error.response?.status;
    const data = error.response?.data;
    return res.status(status || 500).json({
      success: false,
      error: error.message,
      provider: data || null
    });
  }
}
