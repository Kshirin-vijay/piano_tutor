import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { aggregateTeacherReport } from "./backend/lib/aggregate.mjs";

const MOCK_CLASSES: Record<string, { teacher: string; active: boolean; students: { id: string; label: string }[] }> = {
  "DEV-CLASS": { teacher: "Dev Teacher", active: true, students: [{ id: "tester-a1b2", label: "Tester" }] },
};
let mockIdCounter = 0;
let mockPlayCounter = 42;

function buildLocalDashboardReport(from: string, to: string, timezone: string) {
  try {
    const events = JSON.parse(
      readFileSync(new URL("./piano_logs.json", import.meta.url), "utf8")
    ) as Array<Record<string, unknown>>;
    const teacherIds = [
      ...new Set(
        events
          .map((event) => String(event.teacherId ?? "public"))
          .filter(
            (teacherId) =>
              teacherId === "public" ||
              events.some(
                (event) =>
                  event.teacherId === teacherId &&
                  String(event.studentId ?? "").startsWith(`${teacherId}__`)
              )
          )
      ),
    ].sort();
    const rosterByTeacher = new Map();
    for (const teacherId of teacherIds) {
      const students = new Map<string, string>();
      for (const event of events) {
        if (event.teacherId !== teacherId || teacherId === "public") continue;
        const fullId = String(event.studentId ?? "");
        if (!fullId.startsWith(`${teacherId}__`)) continue;
        const id = fullId.slice(teacherId.length + 2);
        students.set(id, String(event.studentLabel ?? id));
      }
      rosterByTeacher.set(teacherId, {
        teacherId,
        teacherName: teacherId === "public" ? "Public practice" : teacherId,
        students: [...students].map(([id, label]) => ({ id, label })),
      });
    }
    return {
      generatedAt: new Date().toISOString(),
      ...aggregateTeacherReport({
        events,
        rosterByTeacher,
        teacherIds,
        from,
        to,
        timezone,
      }),
    };
  } catch {
    return null;
  }
}

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonBody(
  req: import("http").IncomingMessage,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = JSON.parse(await readBody(req));
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

function sendJson(
  res: import("http").ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function devApiSink(dashboardPassword: string): Plugin {
  return {
    name: "dev-api-sink",
    configureServer(server) {
      server.middlewares.use("/api/dashboard/auth", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("{}"); return; }
        const body = await readJsonBody(req);
        if (!body) {
          sendJson(res, 400, { error: "Request body must be a JSON object." });
          return;
        }
        if (!dashboardPassword || body.password !== dashboardPassword) {
          sendJson(res, 401, { error: "Invalid credentials." });
          return;
        }
        sendJson(res, 200, { token: "dev-dashboard-token", expiresInSeconds: 28800 });
      });

      server.middlewares.use("/api/dashboard/report", (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
        const from = url.searchParams.get("from") ?? to;
        const timezone = url.searchParams.get("timezone") ?? "America/Los_Angeles";
        const report = buildLocalDashboardReport(from, to, timezone);
        res.setHeader("Content-Type", "application/json");
        if (!report) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Could not read piano_logs.json" }));
          return;
        }
        res.end(JSON.stringify(report));
      });

      server.middlewares.use("/api/counter", (req, res) => {
        if (req.method === "POST") mockPlayCounter++;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ totalPlays: mockPlayCounter }));
      });

      server.middlewares.use("/api/auth/student", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("{}"); return; }
        const body = await readJsonBody(req);
        if (!body) {
          sendJson(res, 400, { error: "Request body must be a JSON object." });
          return;
        }
        const code = String(body.code ?? "").toUpperCase();
        const cls = MOCK_CLASSES[code];
        if (!cls || !cls.active) { res.statusCode = 403; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "Invalid class code" })); return; }
        const name = String(body.name ?? "").trim();
        if (!name || name.length > 30) {
          sendJson(res, 400, { error: "Name must be between 1 and 30 characters." });
          return;
        }
        const slug = slugify(name);
        if (!slug) {
          sendJson(res, 400, { error: "Name must contain at least one letter or number." });
          return;
        }
        const id = `${slug}-${(++mockIdCounter).toString(16).padStart(4, "0")}`;
        const added = { id, label: name };
        cls.students.push(added);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ code, teacher: cls.teacher, students: cls.students, added }));
      });

      server.middlewares.use("/api/auth", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("{}"); return; }
        const body = await readJsonBody(req);
        if (!body) {
          sendJson(res, 400, { error: "Request body must be a JSON object." });
          return;
        }
        const code = String(body.code ?? "").toUpperCase();
        const cls = MOCK_CLASSES[code];
        if (!cls || !cls.active) { res.statusCode = 403; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "Invalid class code" })); return; }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ code, teacher: cls.teacher, students: cls.students }));
      });

      server.middlewares.use("/api/log", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            console.log("[dev-log]", body.event, body);
          } catch {
            /* ignore malformed body */
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = process.env.VITE_BASE ?? env.VITE_BASE ?? "/";
  return {
    base,
    plugins: [
    react(),
    devApiSink(env.DASHBOARD_DEV_PASSWORD ?? ""),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Piano Friend",
        short_name: "Piano Friend",
        description: "A calm, predictable piano-learning app.",
        theme_color: "#f4f1ea",
        background_color: "#f4f1ea",
        display: "standalone",
        orientation: "any",
        start_url: base,
        scope: base,
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,mp3,wav,ogg}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
    ],
  };
});
