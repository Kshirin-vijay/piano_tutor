/**
 * POST /api/login — validate an email against the server-only allowlist.
 * Body: { email: string }
 * 200: { email, userId }
 * 403: { error }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { findBetaUser, normalizeEmail } from "./betaUsers.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const email =
    typeof req.body?.email === "string" ? req.body.email.trim() : "";

  if (!email) {
    return res.status(400).json({ error: "Please enter your email." });
  }

  const user = findBetaUser(email);
  if (!user) {
    return res.status(403).json({
      error: "This email is not on the beta list. Ask for an invite.",
    });
  }

  return res.status(200).json({
    email: normalizeEmail(user.email),
    userId: user.userId,
  });
}
