import axios from "axios";
export { default } from "./api/status.js";

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

    // Log FULL response untuk debugging
    console.log("[CHECKPAYMENT-DEBUG]", {
      idTransaksi,
      statusCode: data?.statusCode,
      results: JSON.stringify(data?.results),
      fullResponse: JSON.stringify(data)
    });

    if (!data) {
      return res.status(500).json({ 
        success: false, 
        error: "Empty response from provider" 
      });
    }

    // Cek status 200 = PAID
    if (data.statusCode === 200 && data.results) {
      const results = data.results;
      
      // Validasi SUPER KETAT - harus ada salah satu indikator paid
      const isPaid = 
        results.paid === true ||
        results.status === "PAID" ||
        results.status === "SUCCESS" ||
        results.status === "success" ||
        results.paymentStatus === "PAID" ||
        results.settlementStatus === "settlement" ||
        (results.transactionStatus && results.transactionStatus.toLowerCase() === "settlement") ||
        !!results.paidAt ||
        !!results.settlementTime;

      console.log("[CHECKPAYMENT-VALIDATION]", {
        idTransaksi,
        isPaid,
        results: JSON.stringify(results)
      });

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
        // Status 200 tapi ga ada bukti paid - FALSE POSITIVE!
        console.warn("[CHECKPAYMENT-FALSE-POSITIVE]", {
          idTransaksi,
          statusCode: data.statusCode,
          results: JSON.stringify(results)
        });
        
        return res.status(200).json({
          success: true,
          paymentStatus: "Waiting for payment",
          data: results,
          warning: "Status 200 but no payment proof"
        });
      }
    }

    // Status 202 = PENDING
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
      error: error.message,
      response: error.response?.data
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
