import axios from "axios";

const VPS_BASE = "http://82.27.2.229:5021";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const idTransaksi = String(req.query?.idTransaksi || "").trim();
  if (!idTransaksi) {
    return res.status(400).json({ success: false, error: "idTransaksi required" });
  }

  try {
    const r = await axios.get(`${VPS_BASE}/status`, {
      params: { idTransaksi },
      timeout: 8000,
      validateStatus: () => true,
    });

    // terusin response dari VPS apa adanya
    return res.status(r.status).json(r.data);
  } catch (e) {
    return res.status(502).json({
      success: false,
      error: "Proxy to VPS failed",
      message: e.message,
    });
  }
}
