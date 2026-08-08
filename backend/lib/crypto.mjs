import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_DIGEST = "sha256";
const PBKDF2_KEYLEN = 32;

export function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

export function stableHash(parts) {
  return sha256Hex(parts.map((p) => String(p ?? "")).join("|"));
}

export function generateSalt(bytes = 16) {
  return randomBytes(bytes).toString("base64url");
}

export function hashPassword(password, saltBase64) {
  const salt = Buffer.from(saltBase64, "base64url");
  const derived = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return derived.toString("base64url");
}

export function verifyPassword(password, expectedHash, saltBase64) {
  if (!password || !expectedHash || !saltBase64) return false;
  const actual = hashPassword(password, saltBase64);
  const a = Buffer.from(actual, "base64url");
  const b = Buffer.from(expectedHash, "base64url");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signToken(payload, signingSecret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifySignedToken(token, signingSecret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = createHmac("sha256", signingSecret)
    .update(`${header}.${body}`)
    .digest("base64url");
  const a = Buffer.from(signature, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createDashboardToken(signingSecret, ttlSeconds = 8 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  return signToken(
    { sub: "dashboard-admin", iat: now, exp: now + ttlSeconds },
    signingSecret,
  );
}
