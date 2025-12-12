import axios from "axios";

const VPS_BASE = "http://82.27.2.229:5021";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const id = req.query.idTransaksi || req.query.id || "";
  if (!id) {
    return res.status(400).json({ success: false, error: "idTransaksi required" });
  }

  try {
    const r = await axios.get(`${VPS_BASE}/status/${encodeURIComponent(id)}`, {
      timeout: 8000,
      headers: { "Accept": "application/json" }
    });
    return res.status(200).json(r.data);
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message,
      provider: e.response?.data || null
    });
  }
}
