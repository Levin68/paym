// lib/github.js
const axios = require("axios");

function b64encode(str) {
  return Buffer.from(str, "utf8").toString("base64");
}
function b64decode(b64) {
  return Buffer.from(b64, "base64").toString("utf8");
}

// ⚠️ Jangan hardcode token di repo publik.
// Isi lewat ENV di Vercel (recommended).
const GH = {
  token: process.env.GITHUB_TOKEN || "", // <-- isi di Vercel ENV
  owner: process.env.GH_OWNER || "Levin68",
  repo: process.env.GH_REPO || "database-levpay",
  branch: process.env.GH_BRANCH || "main",
  path: process.env.GH_FILE || "database.json",
};

function mustToken() {
  if (!GH.token) throw new Error("GITHUB_TOKEN kosong. Set di Vercel Environment Variables.");
}

function ghHeaders() {
  mustToken();
  return {
    Authorization: `Bearer ${GH.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    Accept: "application/vnd.github+json",
  };
}

function contentsUrl() {
  return `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${encodeURIComponent(GH.path)}?ref=${encodeURIComponent(GH.branch)}`;
}

async function readJsonFile() {
  // kalau file belum ada → return default
  try {
    const r = await axios.get(contentsUrl(), { headers: ghHeaders(), timeout: 15000 });
    const content = r?.data?.content || "";
    const sha = r?.data?.sha || "";
    const text = b64decode(content.replace(/\n/g, ""));

    let json;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!json || typeof json !== "object") json = defaultDb();
    return { json, sha };
  } catch (e) {
    // kalau 404: file belum ada
    if (e?.response?.status === 404) {
      return { json: defaultDb(), sha: null };
    }
    throw e;
  }
}

async function writeJsonFile(json, sha, message = "Update database.json") {
  const url = `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${encodeURIComponent(GH.path)}`;

  const body = {
    message,
    content: b64encode(JSON.stringify(json, null, 2)),
    branch: GH.branch,
  };
  if (sha) body.sha = sha;

  // retry simpel buat race update (409)
  for (let i = 0; i < 2; i++) {
    try {
      const r = await axios.put(url, body, { headers: ghHeaders(), timeout: 20000 });
      return r.data;
    } catch (e) {
      if (e?.response?.status === 409 && i === 0) {
        const fresh = await readJsonFile();
        sha = fresh.sha;
        body.sha = sha;
        continue;
      }
      throw e;
    }
  }
}

function defaultDb() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    devices: {},
    promo2: { codes: {} },
  };
}

module.exports = {
  GH,
  readJsonFile,
  writeJsonFile,
  defaultDb,
};
