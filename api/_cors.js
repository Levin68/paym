// api/_cors.js
module.exports.applyCors = function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://api-orkut-brown.vercel.app/");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-User");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
};
