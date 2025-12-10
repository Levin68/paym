// api/checkpayment.js
import axios from "axios";

const ZENITSU_CONFIG = {
  username: "vinzyy",
  token: "1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh",
};

// helper: "15.000" -> 15000
function parseKreditToInt(kredit) {
  if (!kredit) return 0;
  const cleaned = kredit.replace(/\D/g, "");
  return Number(cleaned || "0");
}

async function checkPaymentStatusFromMutasi(expectedAmount) {
  try {
    const response = await axios.post(
      "https://api.zenitsu.web.id/api/orkut/mutasi",
      {
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token,
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
      return {
        status: "error",
        message: "Failed to fetch mutation data",
      };
    }

    const mutasi = response.data.results;
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const payment = mutasi.find((trx) => {
      try {
        // format tanggal: "31/12/2025 23:59"
        const [datePart, timePart] = trx.tanggal.split(" ");
        const [day, month, year] = datePart.split("/");
        const transactionDate = new Date(
          `${year}-${month}-${day}T${timePart}:00`
        );

        const isRecent = transactionDate >= fiveMinutesAgo;
        const isIncoming = trx.status === "IN";

        const transactionAmount = parseKreditToInt(trx.kredit);
        const amountMatch = transactionAmount === expectedAmount;

        return isRecent && isIncoming && amountMatch;
      } catch (e) {
        console.log("❌ Error parsing transaction:", e);
        return false;
      }
    });

    if (payment) {
      return { status: "paid", data: payment };
    } else {
      return { status: "pending" };
    }
  } catch (error) {
    console.error("❌ Error checking payment status:", error.message);
    return { status: "error", message: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method Not Allowed" });
  }

  // DEBUG dikit biar kalau 400 keliatan
  console.log("checkpayment BODY:", req.body);

  const { amount } = req.body;
  const numericAmount = Number(amount);

  if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid amount",
    });
  }

  const paymentStatus = await checkPaymentStatusFromMutasi(numericAmount);

  if (paymentStatus.status === "paid") {
    return res.status(200).json({
      success: true,
      paymentStatus: "Payment successful",
      data: paymentStatus.data,
    });
  } else if (paymentStatus.status === "pending") {
    return res.status(200).json({
      success: true,
      paymentStatus: "Waiting for payment",
    });
  } else {
    return res.status(500).json({
      success: false,
      error: paymentStatus.message || "Error checking payment status",
    });
  }
}
