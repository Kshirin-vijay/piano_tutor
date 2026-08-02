import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.VITE_BASE ?? "/";

const MOCK_CLASSES: Record<string, { teacher: string; active: boolean; students: { id: string; label: string }[] }> = {
  "DEV-CLASS": { teacher: "Dev Teacher", active: true, students: [{ id: "tester-a1b2", label: "Tester" }] },
};
let mockIdCounter = 0;
let mockPlayCounter = 42;

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function devApiSink(): Plugin {
  return {
    name: "dev-api-sink",
    configureServer(server) {
      server.middlewares.use("/api/counter", (req, res) => {
        if (req.method === "POST") mockPlayCounter++;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ totalPlays: mockPlayCounter }));
      });

      server.middlewares.use("/api/auth/student", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("{}"); return; }
        const body = JSON.parse(await readBody(req));
        const code = (body.code ?? "").toUpperCase();
        const cls = MOCK_CLASSES[code];
        if (!cls || !cls.active) { res.statusCode = 403; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "Invalid class code" })); return; }
        const name = (body.name ?? "").trim();
        const id = `${name.toLowerCase()}-${(++mockIdCounter).toString(16).padStart(4, "0")}`;
        const added = { id, label: name };
        cls.students.push(added);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ code, teacher: cls.teacher, students: cls.students, added }));
      });

      server.middlewares.use("/api/auth", async (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end("{}"); return; }
        const body = JSON.parse(await readBody(req));
        const code = (body.code ?? "").toUpperCase();
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

export default defineConfig({
  base,
  plugins: [
    react(),
    devApiSink(),
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
});
