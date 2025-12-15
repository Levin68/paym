// api/orkut.js (Vercel Serverless Function - CommonJS)

const VPS_BASE = "http://82.27.2.229:5021"; // IP VPS lu (HTTP)
const DEFAULT_THEME = "theme2";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

async function vpsFetch(path, { method = "GET", body = null, headers = {} } = {}) {
  const url = `${VPS_BASE}${path}`;
  const init = {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    }
  };
  if (body) init.body = JSON.stringify(body);

  const r = await fetch(url, init);
  const contentType = r.headers.get("content-type") || "";

  // image/png streaming
  if (contentType.includes("image/")) {
    const ab = await r.arrayBuffer();
    return {
      ok: r.ok,
      status: r.status,
      contentType,
      buffer: Buffer.from(ab)
    };
  }

  const text = await r.text();
  const json = safeJsonParse(text);
  return {
    ok: r.ok,
    status: r.status,
    contentType,
    text,
    json
  };
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // health
    if (req.method === "GET" && (!req.query || !req.query.op)) {
      return res.status(200).json({
        ok: true,
        service: "levpay-vercel-proxy",
        vps: VPS_BASE
      });
    }

    const op = (req.query?.op || req.body?.op || "").toString().toLowerCase().trim();

    // ====== GET STATUS ======
    if (req.method === "GET" && op === "status") {
      const idTransaksi = (req.query?.idTransaksi || "").toString().trim();
      if (!idTransaksi) return res.status(400).json({ success: false, error: "idTransaksi required" });

      const out = await vpsFetch(`/api/status?idTransaksi=${encodeURIComponent(idTransaksi)}`);
      if (!out.ok) {
        return res.status(out.status).json(out.json || { success: false, error: out.text || "VPS error" });
      }
      return res.status(200).json(out.json || { success: true, raw: out.text });
    }

    // ====== GET QR PNG (proxy image) ======
    if (req.method === "GET" && op === "qr") {
      const file = (req.query?.file || "").toString().trim(); // ex: LEVPAY-12345.png
      if (!file) return res.status(400).send("file required");

      const out = await vpsFetch(`/api/qr/${encodeURIComponent(file)}`);
      if (!out.ok) return res.status(out.status).send("not found");

      res.setHeader("Content-Type", out.contentType || "image/png");
      return res.status(200).send(out.buffer);
    }

    // ====== POST CREATEQR / CANCEL ======
    if (req.method === "POST") {
      // CREATE QR
      if (op === "createqr") {
        const amount = Number(req.body?.amount);
        const theme = (req.body?.theme || DEFAULT_THEME).toString();

        if (!Number.isFinite(amount) || amount < 1) {
          return res.status(400).json({ success: false, error: "amount invalid" });
        }

        const out = await vpsFetch(`/api/createqr`, {
          method: "POST",
          body: { amount, theme }
        });

        if (!out.ok) {
          return res.status(out.status).json(out.json || { success: false, error: out.text || "VPS error" });
        }

        // rewrite qrPngUrl dari VPS -> jadi lewat proxy Vercel biar aman dari mixed-content
        const payload = out.json || {};
        const data = payload?.data;
        if (data?.idTransaksi) {
          const file = `${data.idTransaksi}.png`;
          data.qrPngUrl = `/api/orkut?op=qr&file=${encodeURIComponent(file)}`;
        }

        return res.status(200).json(payload);
      }

      // CANCEL
      if (op === "cancel") {
        const idTransaksi = (req.body?.idTransaksi || "").toString().trim();
        if (!idTransaksi) return res.status(400).json({ success: false, error: "idTransaksi required" });

        const out = await vpsFetch(`/api/cancel`, {
          method: "POST",
          body: { idTransaksi }
        });

        if (!out.ok) {
          return res.status(out.status).json(out.json || { success: false, error: out.text || "VPS error" });
        }
        return res.status(200).json(out.json || { success: true, raw: out.text });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid op",
        hint: "Use op=createqr|cancel in JSON body"
      });
    }

    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || "server error" });
  }
};
