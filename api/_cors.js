// api/_cors.js
export function applyCors(req, res) {
  // kalau mau ketat, ganti "*" jadi domain frontend lo
  res.setHeader("Access-Control-Allow-Origin", "https://api-orkut-brown.vercel.app/");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  // preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // stop handler
  }
  return false;
}
