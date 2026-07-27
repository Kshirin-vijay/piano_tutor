/**
 * POST /api/log — append one usage event to today's log file (Blob or local).
 * Body: { teacherId, studentId, studentLabel?, event, ...properties }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { appendUsageLog } from "./usageLog";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = req.body ?? {};
  const teacherId = typeof body.teacherId === "string" ? body.teacherId.trim() : "";
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  const event = typeof body.event === "string" ? body.event.trim() : "";

  if (!teacherId || !studentId || !event) {
    return res.status(400).json({ error: "Missing teacherId, studentId, or event." });
  }

  const { teacherId: _t, studentId: _s, event: _e, ...rest } = body as Record<
    string,
    unknown
  >;

  try {
    await appendUsageLog({
      ts: new Date().toISOString(),
      teacherId,
      studentId,
      studentLabel:
        typeof body.studentLabel === "string" ? body.studentLabel : undefined,
      event,
      ...rest,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("appendUsageLog failed:", err);
    return res.status(500).json({ error: "Failed to write log." });
  }
}
