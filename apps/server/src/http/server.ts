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

  const { webDist } = getContext();
  if (webDist && fs.existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: "/",
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "Маршрут не найден",
          requestId: crypto.randomUUID(),
        });
      }
      const index = path.join(webDist, "index.html");
      return reply.type("text/html").send(fs.readFileSync(index));
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
