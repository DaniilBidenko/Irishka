import type { FastifyInstance } from "fastify";
import {
  CreateClientSchema,
  CreateCostServiceSchema,
  CreateInstallationSchema,
  DefineCustomFieldSchema,
  PinClientSchema,
  QueryInstallationsSchema,
  SaveLayoutSchema,
  SetCompletedSchema,
  SetStageSchema,
  UpdateClientSchema,
  UpdateCostServiceSchema,
  UpdateInstallationSchema,
} from "@workbook/contracts";
import {
  archiveCustomField,
  createClient,
  createCostService,
  createInstallation,
  defineCustomField,
  getClientMonth,
  getLayout,
  listClients,
  listCostServices,
  listTrash,
  pinClient,
  queryInstallations,
  resetLayout,
  restoreClientBatch,
  restoreInstallation,
  saveLayout,
  setCompleted,
  setStage,
  trashClient,
  trashCostService,
  trashInstallation,
  updateClient,
  updateCostService,
  updateInstallation,
} from "@workbook/application";
import {
  normalizeSearchText,
  isClientKind,
  isCostCategory,
} from "@workbook/domain";
import {
  createVerifiedBackup,
  getAppliedMigrations,
} from "@workbook/infrastructure";
import { APP_VERSION, getContext } from "../../bootstrap/appContext.js";
import { sendError } from "../errors.js";
import { ensureSession } from "../security.js";

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/session", async (req, reply) => {
    const session = await ensureSession(req, reply);
    const { config } = getContext();
    return {
      csrfToken: session.csrfToken,
      instanceId: config.instanceId,
      appVersion: APP_VERSION,
      currency: {
        code: config.defaultCurrencyCode,
        scale: config.defaultCurrencyScale,
      },
    };
  });

  app.get("/api/v1/health", async () => {
    const { config, db, maintenance, paths } = getContext();
    const applied = getAppliedMigrations(db);
    const dataRoot = paths.root.replace(/\\/g, "/").toLowerCase();
    const devSandbox =
      process.env.WORKBOOK_TEST === "1" || dataRoot.includes("/.tmp/");
    return {
      ok: true,
      appVersion: APP_VERSION,
      schemaVersion: applied[applied.length - 1] ?? null,
      instanceId: config.instanceId,
      maintenance: maintenance.enabled,
      devSandbox,
    };
  });

  app.get("/api/v1/identity", async () => {
    const { config } = getContext();
    return {
      name: "WorkNotebook",
      instanceId: config.instanceId,
      appVersion: APP_VERSION,
      port: config.port,
    };
  });

  app.get("/api/v1/clients", async (req, reply) => {
    try {
      const q = req.query as { kind?: string };
      if (!q.kind || !isClientKind(q.kind)) {
        return reply.code(400).send({
          code: "VALIDATION",
          message: "Параметр kind обязателен: corporate|retail",
          requestId: crypto.randomUUID(),
        });
      }
      return { items: listClients(getContext().ports, q.kind) };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/clients", async (req, reply) => {
    try {
      const body = CreateClientSchema.parse(req.body);
      const row = createClient(getContext().ports, body);
      return reply.code(201).send(row);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.patch("/api/v1/clients/:id", async (req, reply) => {
    try {
      const body = UpdateClientSchema.parse(req.body);
      const { id } = req.params as { id: string };
      return updateClient(getContext().ports, id, body);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/clients/:id/pin", async (req, reply) => {
    try {
      const body = PinClientSchema.parse(req.body);
      const { id } = req.params as { id: string };
      return pinClient(getContext().ports, id, body);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/clients/:id/trash", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return trashClient(getContext().ports, id);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.get("/api/v1/trash", async (req, reply) => {
    try {
      return listTrash(getContext().ports);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/trash/restore-batch", async (req, reply) => {
    try {
      const body = req.body as { batchId?: string };
      if (!body.batchId) {
        return reply.code(400).send({
          code: "VALIDATION",
          message: "batchId обязателен",
          requestId: crypto.randomUUID(),
        });
      }
      const n = restoreClientBatch(getContext().ports, body.batchId);
      return { restored: n };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.get("/api/v1/clients/:id/month", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const q = req.query as {
        year?: string;
        month?: string;
        includeCompleted?: string;
      };
      const year = Number(q.year);
      const month = Number(q.month);
      if (!year || month < 1 || month > 12) {
        return reply.code(400).send({
          code: "VALIDATION",
          message: "Укажите year и month (1–12)",
          requestId: crypto.randomUUID(),
        });
      }
      return getClientMonth(
        getContext().ports,
        id,
        year,
        month,
        q.includeCompleted === "1" || q.includeCompleted === "true",
      );
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/installations", async (req, reply) => {
    try {
      const body = CreateInstallationSchema.parse(req.body);
      const row = createInstallation(getContext().ports, body);
      return reply.code(201).send(row);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.get("/api/v1/installations/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const row = getContext().ports.installations.findById(id);
      if (!row) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "Монтаж не найден",
          requestId: crypto.randomUUID(),
        });
      }
      return row;
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.patch("/api/v1/installations/:id", async (req, reply) => {
    try {
      const body = UpdateInstallationSchema.parse(req.body);
      const { id } = req.params as { id: string };
      return updateInstallation(getContext().ports, id, body);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/installations/:id/stages", async (req, reply) => {
    try {
      const body = SetStageSchema.parse(req.body);
      const { id } = req.params as { id: string };
      return setStage(getContext().ports, id, body);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/installations/:id/completed", async (req, reply) => {
    try {
      const body = SetCompletedSchema.parse(req.body);
      const { id } = req.params as { id: string };
      return setCompleted(getContext().ports, id, body);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/installations/:id/trash", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { revision?: number };
      if (!body.revision) {
        return reply.code(400).send({
          code: "VALIDATION",
          message: "revision обязателен",
          requestId: crypto.randomUUID(),
        });
      }
      trashInstallation(getContext().ports, id, body.revision);
      return { ok: true };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/installations/:id/restore", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      restoreInstallation(getContext().ports, id);
      return { ok: true };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.get("/api/v1/installations", async (req, reply) => {
    try {
      const parsed = QueryInstallationsSchema.parse(req.query);
      const stages: Partial<
        Record<"CRM" | "YOU" | "MON" | "SO" | "PP" | "UR", "any" | "on" | "off">
      > = {};
      if (parsed.stageCRM) stages.CRM = parsed.stageCRM;
      if (parsed.stageYOU) stages.YOU = parsed.stageYOU;
      if (parsed.stageMON) stages.MON = parsed.stageMON;
      if (parsed.stageSO) stages.SO = parsed.stageSO;
      if (parsed.stagePP) stages.PP = parsed.stagePP;
      if (parsed.stageUR) stages.UR = parsed.stageUR;
      const result = queryInstallations(getContext().ports, {
        qNormalized: parsed.q ? normalizeSearchText(parsed.q) : undefined,
        kind: parsed.kind,
        clientId: parsed.clientId,
        workFrom: parsed.workFrom,
        workTo: parsed.workTo,
        dueFrom: parsed.dueFrom,
        dueTo: parsed.dueTo,
        status: parsed.status ?? "active",
        dueBucket: parsed.dueBucket,
        stages: Object.keys(stages).length ? stages : undefined,
        sort: parsed.sort ?? "due",
        sortDir: parsed.sortDir ?? "asc",
        limit: parsed.limit ?? 50,
        offset: parsed.offset ?? 0,
      });
      return result;
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.get("/api/v1/layouts/:scope", async (req, reply) => {
    try {
      const { scope } = req.params as { scope: "main" | "compact" };
      return { fields: getLayout(getContext().ports, scope) };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.put("/api/v1/layouts/:scope", async (req, reply) => {
    try {
      const body = SaveLayoutSchema.parse({
        ...(req.body as object),
        layoutScope: (req.params as { scope: string }).scope,
      });
      saveLayout(getContext().ports, body);
      return { ok: true };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/layouts/:scope/reset", async (req, reply) => {
    try {
      const { scope } = req.params as { scope: "main" | "compact" };
      resetLayout(getContext().ports, scope);
      return { ok: true };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.get("/api/v1/cost-services", async (req, reply) => {
    try {
      const q = req.query as { category?: string };
      if (q.category && !isCostCategory(q.category)) {
        return reply.code(400).send({
          code: "VALIDATION",
          message: "Параметр category: polygraphy|souvenirs|outdoor",
          requestId: crypto.randomUUID(),
        });
      }
      const category =
        q.category && isCostCategory(q.category) ? q.category : undefined;
      return {
        items: listCostServices(
          getContext().ports,
          category ? { category } : undefined,
        ),
      };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/cost-services", async (req, reply) => {
    try {
      const body = CreateCostServiceSchema.parse(req.body);
      return reply
        .code(201)
        .send(createCostService(getContext().ports, body));
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.patch("/api/v1/cost-services/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = UpdateCostServiceSchema.parse(req.body);
      return updateCostService(getContext().ports, id, body);
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/cost-services/:id/trash", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { revision?: number };
      if (!body.revision) {
        return reply.code(400).send({
          code: "VALIDATION",
          message: "revision обязателен",
          requestId: crypto.randomUUID(),
        });
      }
      trashCostService(getContext().ports, id, body.revision);
      return { ok: true };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.get("/api/v1/custom-fields", async () => {
    return {
      items: getContext().ports.customFields.listDefinitions(true),
    };
  });

  app.post("/api/v1/custom-fields", async (req, reply) => {
    try {
      const body = DefineCustomFieldSchema.parse(req.body);
      return reply.code(201).send(defineCustomField(getContext().ports, body));
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/custom-fields/:id/archive", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { revision?: number };
      if (!body.revision) {
        return reply.code(400).send({
          code: "VALIDATION",
          message: "revision обязателен",
          requestId: crypto.randomUUID(),
        });
      }
      archiveCustomField(getContext().ports, id, body.revision);
      return { ok: true };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.get("/api/v1/preferences/:key", async (req, reply) => {
    try {
      const { key } = req.params as { key: string };
      const row = getContext().ports.settings.getJson(key);
      if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "Нет настройки", requestId: crypto.randomUUID() });
      return row;
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.put("/api/v1/preferences/:key", async (req, reply) => {
    try {
      const { key } = req.params as { key: string };
      const body = req.body as { version: number; value: unknown };
      getContext().ports.settings.setJson(key, body.version, body.value);
      return { ok: true };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });

  app.post("/api/v1/backups", async (req, reply) => {
    try {
      const { db, paths, config } = getContext();
      const applied = getAppliedMigrations(db);
      const result = await createVerifiedBackup({
        db,
        paths,
        appVersion: APP_VERSION,
        schemaVersion: applied[applied.length - 1] ?? "unknown",
        instanceId: config.instanceId,
        reason: "manual",
      });
      return {
        path: result.archivePath,
        createdAt: result.manifest.createdAt,
        sha256: result.manifest.dbSha256,
      };
    } catch (err) {
      return sendError(req, reply, err);
    }
  });
}
