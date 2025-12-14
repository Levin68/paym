import axios from "axios";

const VPS_BASE = "http://82.27.2.229:5021";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function noCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

export default async function handler(req, res) {
  setCors(res);
  noCache(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  // ambil id dari query (GET) atau body (POST)
  const idTransaksi =
    (req.query && req.query.idTransaksi) ||
    (req.body && req.body.idTransaksi);

  if (!idTransaksi) {
    return res.status(400).json({ success: false, error: "idTransaksi required" });
  }

  try {
    // cache-buster biar proxy/CDN gak nge-cache request ke VPS
    const url = `${VPS_BASE}/status/${encodeURIComponent(idTransaksi)}?_=${Date.now()}`;

    const r = await axios.get(url, {
      timeout: 8000,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    });

    return res.status(200).json(r.data);
  } catch (e) {
    return res.status(e.response?.status || 500).json({
      success: false,
      error: e.message,
      provider: e.response?.data || null,
    });
  }
}
```0
