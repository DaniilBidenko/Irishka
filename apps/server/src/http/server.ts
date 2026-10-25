import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { ValidationError } from "@workbook/domain";
import { getContext } from "../bootstrap/appContext.js";
import { sendError } from "./errors.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerSecurity } from "./security.js";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.WORKBOOK_LOG_LEVEL ?? "info",
    },
    bodyLimit: 1_000_000,
  });

  await app.register(cookie);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return sendError(
        req,
        reply,
        new ValidationError("Некорректные данные", err.flatten()),
      );
    }
    return sendError(req, reply, err);
  });

  registerSecurity(app);
  await registerApiRoutes(app);

  const { markDataChanged } = await import("../bootstrap/autoBackup.js");
  app.addHook("onResponse", async (req, reply) => {
    const method = req.method.toUpperCase();
    if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(method) &&
      req.url.startsWith("/api/") &&
      reply.statusCode >= 200 &&
      reply.statusCode < 300 &&
      !req.url.includes("/backups") &&
      !req.url.includes("/session")
    ) {
      markDataChanged();
    }
  });

  const { webDist } = getContext();
  if (webDist && fs.existsSync(webDist)) {
    // Раздаём ассеты явно: иначе SPA-fallback отдаёт index.html вместо .js/.css
    // и браузер показывает пустую белую страницу.
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: "/",
      wildcard: true,
      decorateReply: true,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "Маршрут не найден",
          requestId: crypto.randomUUID(),
        });
      }
      const pathOnly = req.url.split("?")[0] ?? "";
      if (/\.[a-zA-Z0-9]+$/.test(pathOnly)) {
        return reply.code(404).send("Not found");
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}

export async function startServer(): Promise<void> {
  const { config } = getContext();
  const app = await buildServer();
  await app.listen({
    host: "127.0.0.1",
    port: config.port,
  });
}
