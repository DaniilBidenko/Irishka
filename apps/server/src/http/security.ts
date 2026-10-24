import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { getContext } from "../bootstrap/appContext.js";

const ALLOWED_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "[::1]",
]);

function hostAllowed(hostHeader: string | undefined, port: number): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.split(",")[0]?.trim().toLowerCase() ?? "";
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, (m) => m);
  const bare = host.includes(":")
    ? host.startsWith("[")
      ? host.slice(1, host.indexOf("]"))
      : host.split(":")[0]!
    : host;
  if (!ALLOWED_HOSTS.has(bare) && bare !== "127.0.0.1" && bare !== "localhost") {
    // also allow host:port forms
    const name = host.split(":")[0]!;
    if (!ALLOWED_HOSTS.has(name)) return false;
  }
  // Accept 127.0.0.1:4318 and localhost:4318
  const nameOnly = host.replace(/:\d+$/, "");
  return (
    ALLOWED_HOSTS.has(nameOnly) ||
    host === `127.0.0.1:${port}` ||
    host === `localhost:${port}`
  );
}

export function registerSecurity(app: FastifyInstance): void {
  app.addHook("onRequest", async (req, reply) => {
    const { config } = getContext();
    const host = req.headers.host;
    if (!hostAllowed(host, config.port)) {
      return reply.code(403).send({
        code: "FORBIDDEN_HOST",
        message: "Запрос отклонён: недопустимый Host",
        requestId: crypto.randomUUID(),
      });
    }

    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    );
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
  });

  app.addHook("preHandler", async (req, reply) => {
    const method = req.method.toUpperCase();
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
    if (!isMutation) return;
    if (!req.url.startsWith("/api/")) return;

    const ctx = getContext();
    if (ctx.maintenance.enabled) {
      return reply.code(503).send({
        code: "MAINTENANCE",
        message: ctx.maintenance.reason ?? "Идёт обслуживание. Запись временно запрещена.",
        requestId: crypto.randomUUID(),
      });
    }

    const origin = req.headers.origin;
    if (origin) {
      const allowed = new Set([
        `http://127.0.0.1:${ctx.config.port}`,
        `http://localhost:${ctx.config.port}`,
      ]);
      if (!allowed.has(origin)) {
        return reply.code(403).send({
          code: "FORBIDDEN_ORIGIN",
          message: "Запрос отклонён: недопустимый Origin",
          requestId: crypto.randomUUID(),
        });
      }
    }

    const ct = req.headers["content-type"] ?? "";
    if (method !== "DELETE" && !String(ct).includes("application/json")) {
      // DELETE without body ok; others need JSON
      if (method === "POST" || method === "PATCH" || method === "PUT") {
        return reply.code(415).send({
          code: "UNSUPPORTED_MEDIA",
          message: "Ожидается Content-Type: application/json",
          requestId: crypto.randomUUID(),
        });
      }
    }

    const csrfCookie = (req.cookies as Record<string, string | undefined>)?.csrf;
    const csrfHeader = req.headers["x-csrf-token"];
    if (!csrfCookie || csrfCookie !== csrfHeader) {
      return reply.code(403).send({
        code: "CSRF",
        message: "Недействительный CSRF-токен. Обновите страницу.",
        requestId: crypto.randomUUID(),
      });
    }
  });
}

export function issueCsrf(reply: FastifyReply): string {
  const token = randomBytes(32).toString("hex");
  reply.setCookie("csrf", token, {
    path: "/",
    sameSite: "strict",
    httpOnly: false,
    secure: false,
  });
  return token;
}

export async function ensureSession(
  _req: FastifyRequest,
  reply: FastifyReply,
): Promise<{ csrfToken: string }> {
  const token = issueCsrf(reply);
  return { csrfToken: token };
}
