import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { findBetaUser, normalizeEmail } from "./api/betaUsers";
import { appendUsageLog } from "./api/usageLog";

// Serve from the site root by default (e.g. Vercel), or from a sub-path on an
// existing site (e.g. AWS S3 at "/piano/") by building with:
//   VITE_BASE=/piano/ npm run build
const base = process.env.VITE_BASE ?? "/";

/**
 * Local-dev stand-in for Vercel's /api/login so `npm run dev` can check the
 * allowlist without putting emails in the client bundle.
 */
function betaLoginDevApi(): Plugin {
  return {
    name: "beta-login-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/login", (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          let email = "";
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
              email?: unknown;
            };
            if (typeof body.email === "string") email = body.email.trim();
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Please enter your email." }));
            return;
          }

          if (!email) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Please enter your email." }));
            return;
          }

          const user = findBetaUser(email);
          res.setHeader("Content-Type", "application/json");
          if (!user) {
            res.statusCode = 403;
            res.end(
              JSON.stringify({
                error: "This email is not on the beta list. Ask for an invite.",
              })
            );
            return;
          }

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              email: normalizeEmail(user.email),
              userId: user.userId,
            })
          );
        });
        req.on("error", () => next());
      });
    },
  };
}

/** Local-dev stand-in for Vercel's /api/log — writes to logs/ on disk. */
function usageLogDevApi(): Plugin {
  return {
    name: "usage-log-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/log", async (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          void (async () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
                teacherId?: unknown;
                studentId?: unknown;
                event?: unknown;
                studentLabel?: unknown;
                [key: string]: unknown;
              };

              const teacherId =
                typeof body.teacherId === "string" ? body.teacherId.trim() : "";
              const studentId =
                typeof body.studentId === "string" ? body.studentId.trim() : "";
              const event =
                typeof body.event === "string" ? body.event.trim() : "";

              if (!teacherId || !studentId || !event) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: "Missing teacherId, studentId, or event.",
                  })
                );
                return;
              }

              const { teacherId: _t, studentId: _s, event: _e, ...rest } = body;
              await appendUsageLog({
                ts: new Date().toISOString(),
                teacherId,
                studentId,
                studentLabel:
                  typeof body.studentLabel === "string"
                    ? body.studentLabel
                    : undefined,
                event,
                ...rest,
              });

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Failed to write log." }));
            }
          })();
        });
        req.on("error", () => next());
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    betaLoginDevApi(),
    usageLogDevApi(),
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
        // Precache the app shell plus the bundled piano samples and images,
        // so the app loads and plays fully offline after the first visit.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,mp3,wav,ogg}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
