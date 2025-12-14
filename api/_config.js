// api/_config.js
export const CFG = {
  ZENITSU_USER: process.env.ZENITSU_USER || "vinzyy",
  ZENITSU_TOKEN: process.env.ZENITSU_TOKEN || "1331927:cCVk0A4be8WL2ONriangdHJvU7utmfTh",
  // GANTI ke HTTPS domain VPS lo kalau bisa (recommended)
  VPS_BASE: (process.env.VPS_BASE || "http://82.27.2.229:5021").replace(/\/+$/, ""),
};
