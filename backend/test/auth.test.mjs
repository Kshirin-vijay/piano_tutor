import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authenticateDashboardPassword,
  authorizeReportRequest,
  parseBearerToken,
} from "../lib/auth.mjs";
import {
  createDashboardToken,
  generateSalt,
  hashPassword,
  verifyPassword,
  verifySignedToken,
} from "../lib/crypto.mjs";

describe("crypto/auth", () => {
  it("hashes and verifies passwords", () => {
    const salt = generateSalt();
    const hash = hashPassword("secret-pass", salt);
    assert.equal(verifyPassword("secret-pass", hash, salt), true);
    assert.equal(verifyPassword("wrong", hash, salt), false);
  });

  it("issues and verifies 8-hour dashboard tokens", () => {
    const signingSecret = generateSalt(32);
    const token = createDashboardToken(signingSecret);
    const payload = verifySignedToken(token, signingSecret);
    assert.ok(payload);
    assert.equal(payload.sub, "dashboard-admin");
    assert.ok(payload.exp > payload.iat);
  });

  it("authenticates dashboard password and rejects invalid credentials", () => {
    const salt = generateSalt();
    const secrets = {
      passwordSalt: salt,
      passwordHash: hashPassword("dashboard-pass", salt),
      signingSecret: generateSalt(32),
    };
    const ok = authenticateDashboardPassword("dashboard-pass", secrets);
    assert.equal(ok.ok, true);
    assert.ok(ok.token);

    const bad = authenticateDashboardPassword("nope", secrets);
    assert.equal(bad.ok, false);
    assert.equal(bad.error, "Invalid credentials.");
  });

  it("authorizes bearer tokens for report access", () => {
    const signingSecret = generateSalt(32);
    const token = createDashboardToken(signingSecret);
    const auth = authorizeReportRequest(token, signingSecret);
    assert.equal(auth.ok, true);
    assert.equal(authorizeReportRequest("bad.token.here", signingSecret).ok, false);
  });

  it("parses Authorization bearer headers", () => {
    const token = parseBearerToken({ Authorization: "Bearer abc.def.ghi" });
    assert.equal(token, "abc.def.ghi");
    assert.equal(parseBearerToken({}), null);
  });
});
