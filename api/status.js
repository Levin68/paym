// api/status.js
import axios from "axios";
export { default } from "./checkpayment.js";

const VPS_BASE = "http://82.27.2.229:5021";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function tryGet(url) {
  return axios.get(url, { timeout: 8000, validateStatus: () => true });
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const idTransaksi = String(req.query?.idTransaksi || "").trim();
  if (!idTransaksi) {
    return res.status(400).json({ success: false, error: "idTransaksi required" });
  }

  const id = encodeURIComponent(idTransaksi);

  // coba beberapa kemungkinan route VPS (karena kode lu campur /api dan non-/api)
  const candidates = [
    `${VPS_BASE}/api/status/${id}`,
    `${VPS_BASE}/status/${id}`,
    `${VPS_BASE}/api/status?idTransaksi=${id}`,
    `${VPS_BASE}/status?idTransaksi=${id}`,
  ];

  try {
    for (const url of candidates) {
      const r = await tryGet(url);

      // kalau VPS jawab 200 dan ada body, langsung return
      if (r.status === 200 && r.data) {
        return res.status(200).json(r.data);
      }

      // kalau bukan 404/405 (misal 400/500), lempar balik biar keliatan errornya
      if (![404, 405].includes(r.status)) {
        return res.status(r.status).json(r.data || { success: false, error: `VPS HTTP ${r.status}` });
      }
    }

    // semua route gagal
    return res.status(404).json({
      success: false,
      error: "VPS status endpoint not found (all candidates 404/405)",
      tried: candidates,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message,
    });
  }
}
