import axios from "axios";

const ZENITSU_CONFIG = {
  username: "vinzyy",
  token: "1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh",
};

const ZENITSU_CHECK_URL = "https://api.zenitsu.web.id/api/orkut/checkpayment";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function pickId(req) {
  return String(req.query?.idTransaksi || req.body?.idTransaksi || "").trim();
}

function normalizeStatus(providerData) {
  // coba ambil status dari beberapa kemungkinan field
  const raw =
    providerData?.status ||
    providerData?.results?.status ||
    providerData?.results?.state ||
    providerData?.data?.status ||
    providerData?.data?.state;

  const s = String(raw || "").toLowerCase().trim();

  if (["paid", "success", "settlement", "done", "berhasil"].includes(s)) return "paid";
  if (["expired", "cancel", "canceled", "cancelled", "failed", "gagal"].includes(s))
    return "expired";
  return "pending";
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  const idTransaksi = pickId(req);
  if (!idTransaksi) {
    return res.status(400).json({ success: false, error: "idTransaksi required" });
  }

  try {
    const r = await axios.post(
      ZENITSU_CHECK_URL,
      {
        username: ZENITSU_CONFIG.username,
        token: ZENITSU_CONFIG.token,
        idtrx: idTransaksi,        // ✅ jaga-jaga kalau zenitsu pakai idtrx
        idTransaksi: idTransaksi,  // ✅ jaga-jaga kalau zenitsu pakai idTransaksi
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    // kalau provider ngaco / bukan 200
    if (r.status !== 200) {
      return res.status(502).json({
        success: false,
        error: `Provider HTTP ${r.status}`,
        provider: r.data || null,
      });
    }

    const status = normalizeStatus(r.data);

    return res.status(200).json({
      success: true,
      status,          // "pending" | "paid" | "expired"
      idTransaksi,
      provider: r.data // biar gampang debug
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e.message,
    });
  }
}
