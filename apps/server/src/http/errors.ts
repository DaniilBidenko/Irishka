import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ConflictError,
  DomainError,
  MaintenanceError,
  NotFoundError,
  ValidationError,
} from "@workbook/domain";

export function requestIdOf(req: FastifyRequest): string {
  const h = req.headers["x-request-id"];
  if (typeof h === "string" && h) return h;
  return crypto.randomUUID();
}

export function sendError(
  req: FastifyRequest,
  reply: FastifyReply,
  err: unknown,
): FastifyReply {
  const requestId = requestIdOf(req);

  if (err instanceof ValidationError) {
    return reply.code(400).send({
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
    });
  }
  if (err instanceof NotFoundError) {
    return reply.code(404).send({
      code: err.code,
      message: err.message,
      requestId,
    });
  }
  if (err instanceof ConflictError) {
    return reply.code(409).send({
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
    });
  }
  if (err instanceof MaintenanceError) {
    return reply.code(503).send({
      code: err.code,
      message: err.message,
      requestId,
    });
  }
  if (err instanceof DomainError) {
    return reply.code(400).send({
      code: err.code,
      message: err.message,
      requestId,
    });
  }

  const message =
    err instanceof Error ? err.message : "Внутренняя ошибка сервера";
  req.log.error({ err, requestId }, "unhandled");
  return reply.code(500).send({
    code: "INTERNAL",
    message:
      message.includes("База") || message.includes("Конфигурация")
        ? message
        : "Внутренняя ошибка сервера",
    requestId,
  });
}
