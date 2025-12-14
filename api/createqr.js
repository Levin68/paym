import axios from "axios";

const VPS_WATCH_URL = "http://82.27.2.229:5021/watch-payment";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });

  const { amount } = req.body || {};
  const numericAmount = Number(amount);
  if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, error: "Invalid amount" });
  }

  try {
    const response = await axios.post(
      "https://api.zenitsu.web.id/api/orkut/createqr",
      {
        username: process.env.ZENITSU_USERNAME,
        token: process.env.ZENITSU_TOKEN,
        amount: String(numericAmount),
      },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    const r = response.data?.results;
    if (!r?.idtrx || !r?.amount || !(r?.createAt || r?.createdAt) || !r?.url) {
      return res.status(500).json({ success: false, error: "createqr invalid response", provider: response.data });
    }

    const createdAt = r.createAt || r.createdAt;

    // ✅ start watcher di VPS (ini yang bikin polling jalan)
    await axios.post(
      VPS_WATCH_URL,
      {
        idTransaksi: r.idtrx,
        amount: Number(r.amount),
        createdAt,
        expired: r.expired || null,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 7000 }
    );

    return res.status(200).json({
      success: true,
      data: {
        idTransaksi: r.idtrx,
        amount: Number(r.amount),
        createdAt,
        expired: r.expired || null,
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
