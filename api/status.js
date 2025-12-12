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
  if (req.method !== "GET") return res.status(405).json({ success:false, error:"Method Not Allowed" });

  const id = req.query.idTransaksi || req.query.id || "";
  if (!id) return res.status(400).json({ success:false, error:"idTransaksi required" });

  try {
    const r = await axios.get(`${VPS_BASE}/status/${encodeURIComponent(id)}`, { timeout: 8000 });
    return res.status(200).json(r.data);
  } catch (e) {
    return res.status(500).json({ success:false, error:e.message, provider: e.response?.data || null });
  }
}
