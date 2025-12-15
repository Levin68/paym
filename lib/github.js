// lib/github.js
const axios = require("axios");

function must(name, v) {
  if (!v) throw new Error(`Missing ENV: ${name}`);
  return v;
}

function ghCfg() {
  const token = must("GH_TOKEN", process.env.GH_TOKEN);
  return {
    token,
    owner: must("GH_OWNER", process.env.GH_OWNER),
    repo: must("GH_REPO", process.env.GH_REPO),
    branch: process.env.GH_BRANCH || "main",
    path: process.env.GH_DB_PATH || "database.json",
  };
}

function headers() {
  const token = process.env.GH_TOKEN;
  return {
    Authorization: `Bearer ${token}`,
    "User-Agent": "levpay-vercel-proxy",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function defaultDb() {
  return {
    version: 1,
    promos: {},        // { CODE: { percent, expiresAt, maxUses, usedCount, enabled } }
    devices: {},       // { deviceKey: { monthlyUsed: { "2025-12": true } } }
    redemptions: {},   // { CODE: { deviceKey: true } }
    transactions: {},  // { idTransaksi: { ... } }
    updatedAt: new Date().toISOString(),
  };
}

async function getDb() {
  const cfg = ghCfg();
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${encodeURIComponent(cfg.branch)}`;

  try {
    const r = await axios.get(url, { headers: headers(), timeout: 15000, validateStatus: () => true });
    if (r.status === 200) {
      const contentB64 = r.data?.content || "";
      const sha = r.data?.sha;
      const json = contentB64 ? Buffer.from(contentB64, "base64").toString("utf8") : "{}";
      const db = JSON.parse(json || "{}");
      return { db: { ...defaultDb(), ...db }, sha };
    }
    if (r.status === 404) {
      // file belum ada -> init
      return { db: defaultDb(), sha: null };
    }
    throw new Error(`GitHub get failed HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  } catch (e) {
    throw new Error(`GitHub getDb error: ${e.message}`);
  }
}

async function saveDb(db, sha, message = "update database.json") {
  const cfg = ghCfg();
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;

  const body = {
    message,
    content: Buffer.from(JSON.stringify({ ...db, updatedAt: new Date().toISOString() }, null, 2), "utf8").toString("base64"),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;

  const r = await axios.put(url, body, { headers: headers(), timeout: 20000, validateStatus: () => true });

  if (r.status === 200 || r.status === 201) {
    const newSha = r.data?.content?.sha || r.data?.sha || null;
    return { ok: true, sha: newSha };
  }

  // 409 = conflict sha outdated
  if (r.status === 409) return { ok: false, conflict: true, data: r.data };
  throw new Error(`GitHub save failed HTTP ${r.status}: ${JSON.stringify(r.data)}`);
}

async function updateDb(mutatorFn, message) {
  // retry 1x kalau conflict
  for (let attempt = 0; attempt < 2; attempt++) {
    const { db, sha } = await getDb();
    const next = await mutatorFn(db) || db;
    const saved = await saveDb(next, sha, message || "levpay update");
    if (saved.ok) return { db: next, sha: saved.sha };
    if (!saved.conflict) throw new Error("GitHub save failed");
  }
  throw new Error("GitHub updateDb conflict too many times");
}

module.exports = {
  getDb,
  updateDb,
  defaultDb,
};
