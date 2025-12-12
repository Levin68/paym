import axios from "axios";

const ZENITSU_CONFIG = {
  username: "vinzyy",
  token: "1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh",
};

const VPS_WATCH_URL = "http://82.27.2.229:5021/watch-payment";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  // penting buat browser (preflight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const { amount } = req.body || {};
  const numericAmount = Number(amount);

  if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, error: "Invalid amount" });
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

    if (!response.data || response.data.statusCode !== 200 || !response.data.results) {
      return res.status(500).json({ success: false, error: "Failed to generate QR" });
    }

    const r = response.data.results;

    const payload = {
      idTransaksi: r.idtrx,
      amount: Number(r.amount),
      createdAt: r.createAt,
      expired: r.expired,
    };

    // fire-and-forget watcher VPS
    axios
      .post(VPS_WATCH_URL, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      })
      .catch(() => {});

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
    return res.status(500).json({
      success: false,
      error: err.message,
      provider: err.response?.data || null,
    });
  }
}
