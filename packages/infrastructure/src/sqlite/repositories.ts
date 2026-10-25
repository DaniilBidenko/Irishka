import type {
  ClientRecord,
  ClientRepository,
  CostServiceRecord,
  CostServiceRepository,
  CustomFieldRepository,
  InstallationListItem,
  InstallationQueryParams,
  InstallationRecord,
  InstallationRepository,
  LayoutRepository,
  OperationStore,
  SettingsRepository,
  ChangeLogPort,
  TransactionPort,
} from "@workbook/application";
import {
  emptyStages,
  escapeLikeLiteral,
  isCostCategory,
  type ClientKind,
  type StageCode,
  type StagesMap,
} from "@workbook/domain";
import type { SqliteDb } from "./connection.js";
import { STAGE_CODES } from "./connection.js";

type ClientRow = {
  id: string;
  kind: string;
  display_name: string;
  contact_name: string | null;
  phone: string | null;
  notes: string | null;
  pin_order: number | null;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deletion_batch_id: string | null;
};

type InstRow = {
  id: string;
  client_id: string;
  title: string;
  summary: string | null;
  notes: string | null;
  work_date: string;
  due_date: string | null;
  price_minor: number | null;
  cost_minor: number | null;
  installation_minor: number | null;
  currency_code: string;
  currency_scale: number;
  completed: number;
  completed_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deletion_batch_id: string | null;
};

function mapClient(r: ClientRow): ClientRecord {
  return {
    id: r.id,
    kind: r.kind as ClientKind,
    displayName: r.display_name,
    contactName: r.contact_name,
    phone: r.phone,
    notes: r.notes,
    pinOrder: r.pin_order,
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    deletionBatchId: r.deletion_batch_id,
  };
}

function loadStages(db: SqliteDb, installationId: string): StagesMap {
  const stages = emptyStages();
  const rows = db
    .prepare(
      `SELECT stage_code, enabled FROM installation_stages WHERE installation_id = ?`,
    )
    .all(installationId) as Array<{ stage_code: string; enabled: number }>;
  for (const row of rows) {
    stages[row.stage_code as StageCode] = row.enabled === 1;
  }
  return stages;
}

function loadCustomValues(
  db: SqliteDb,
  installationId: string,
): Record<string, string | number | null> {
  const rows = db
    .prepare(
      `SELECT field_id, value_text, value_number, value_date
       FROM installation_custom_values WHERE installation_id = ?`,
    )
    .all(installationId) as Array<{
    field_id: string;
    value_text: string | null;
    value_number: number | null;
    value_date: string | null;
  }>;
  const out: Record<string, string | number | null> = {};
  for (const r of rows) {
    if (r.value_text !== null) out[r.field_id] = r.value_text;
    else if (r.value_number !== null) out[r.field_id] = r.value_number;
    else if (r.value_date !== null) out[r.field_id] = r.value_date;
    else out[r.field_id] = null;
  }
  return out;
}

function mapInstallation(db: SqliteDb, r: InstRow): InstallationRecord {
  return {
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    summary: r.summary,
    notes: r.notes,
    workDate: r.work_date,
    dueDate: r.due_date,
    priceMinor: r.price_minor,
    costMinor: r.cost_minor,
    installationMinor: r.installation_minor,
    currencyCode: r.currency_code,
    currencyScale: r.currency_scale,
    completed: r.completed === 1,
    completedAt: r.completed_at,
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    deletionBatchId: r.deletion_batch_id,
    stages: loadStages(db, r.id),
    customValues: loadCustomValues(db, r.id),
  };
}

export function createTransactionPort(db: SqliteDb): TransactionPort {
  return {
    runInTransaction: <T>(fn: () => T): T => {
      const trx = db.transaction(fn);
      return trx();
    },
  };
}

export function createClientRepository(db: SqliteDb): ClientRepository {
  return {
    findById(id, opts) {
      const row = db
        .prepare(
          opts?.includeDeleted
            ? `SELECT * FROM clients WHERE id = ?`
            : `SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL`,
        )
        .get(id) as ClientRow | undefined;
      return row ? mapClient(row) : null;
    },
    listByKind(kind) {
      const rows = db
        .prepare(
          `SELECT * FROM clients WHERE kind = ? AND deleted_at IS NULL`,
        )
        .all(kind) as ClientRow[];
      return rows.map(mapClient);
    },
    insert(row) {
      db.prepare(
        `INSERT INTO clients (
          id, kind, display_name, contact_name, phone, notes, pin_order,
          revision, created_at, updated_at, deleted_at, deletion_batch_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.kind,
        row.displayName,
        row.contactName,
        row.phone,
        row.notes,
        row.pinOrder,
        row.revision,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.deletionBatchId,
      );
    },
    update(row, expectedRevision) {
      const info = db
        .prepare(
          `UPDATE clients SET
            display_name = ?, contact_name = ?, phone = ?, notes = ?,
            pin_order = ?, revision = ?, updated_at = ?,
            deleted_at = ?, deletion_batch_id = ?
           WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        )
        .run(
          row.displayName,
          row.contactName,
          row.phone,
          row.notes,
          row.pinOrder,
          row.revision,
          row.updatedAt,
          row.deletedAt,
          row.deletionBatchId,
          row.id,
          expectedRevision,
        );
      return info.changes === 1;
    },
    softDeleteBatch(clientId, batchId, deletedAt, installationIds) {
      const client = db
        .prepare(
          `UPDATE clients SET deleted_at = ?, deletion_batch_id = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        )
        .run(deletedAt, batchId, deletedAt, clientId);
      if (client.changes !== 1) {
        throw new Error("Не удалось удалить клиента");
      }
      for (const iid of installationIds) {
        db.prepare(
          `UPDATE installations SET deleted_at = ?, deletion_batch_id = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        ).run(deletedAt, batchId, deletedAt, iid);
      }
      const rev = db
        .prepare(`SELECT revision FROM clients WHERE id = ?`)
        .get(clientId) as { revision: number };
      return { clientRevision: rev.revision };
    },
    restoreBatch(batchId, restoredAt) {
      const c = db
        .prepare(
          `UPDATE clients SET deleted_at = NULL, deletion_batch_id = NULL, revision = revision + 1, updated_at = ?
           WHERE deletion_batch_id = ?`,
        )
        .run(restoredAt, batchId);
      db.prepare(
        `UPDATE installations SET deleted_at = NULL, deletion_batch_id = NULL, revision = revision + 1, updated_at = ?
         WHERE deletion_batch_id = ?`,
      ).run(restoredAt, batchId);
      return c.changes;
    },
    listTrashed() {
      const rows = db
        .prepare(
          `SELECT * FROM clients WHERE deleted_at IS NOT NULL
           ORDER BY deleted_at DESC, id`,
        )
        .all() as ClientRow[];
      return rows.map(mapClient);
    },
  };
}

function saveCustomValues(
  db: SqliteDb,
  installationId: string,
  values: Record<string, string | number | null>,
): void {
  db.prepare(
    `DELETE FROM installation_custom_values WHERE installation_id = ?`,
  ).run(installationId);
  const insert = db.prepare(
    `INSERT INTO installation_custom_values (installation_id, field_id, value_text, value_number, value_date)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const [fieldId, value] of Object.entries(values)) {
    if (value === null) {
      insert.run(installationId, fieldId, null, null, null);
    } else if (typeof value === "number") {
      insert.run(installationId, fieldId, null, value, null);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value.length === 10) {
      // date-looking strings go to value_date only if field type is date — store as text otherwise via defs
      const def = db
        .prepare(`SELECT type FROM custom_field_definitions WHERE id = ?`)
        .get(fieldId) as { type: string } | undefined;
      if (def?.type === "date") {
        insert.run(installationId, fieldId, null, null, value);
      } else {
        insert.run(installationId, fieldId, value, null, null);
      }
    } else {
      insert.run(installationId, fieldId, value, null, null);
    }
  }
}

export function createInstallationRepository(
  db: SqliteDb,
): InstallationRepository {
  return {
    findById(id, opts) {
      const row = db
        .prepare(
          opts?.includeDeleted
            ? `SELECT * FROM installations WHERE id = ?`
            : `SELECT * FROM installations WHERE id = ? AND deleted_at IS NULL`,
        )
        .get(id) as InstRow | undefined;
      return row ? mapInstallation(db, row) : null;
    },
    listForClientMonth(clientId, from, toExclusive, includeCompleted) {
      const rows = db
        .prepare(
          `SELECT * FROM installations
           WHERE client_id = ? AND deleted_at IS NULL
             AND work_date >= ? AND work_date < ?
             ${includeCompleted ? "" : "AND completed = 0"}
           ORDER BY work_date ASC, id ASC`,
        )
        .all(clientId, from, toExclusive) as InstRow[];
      return rows.map((r) => mapInstallation(db, r));
    },
    countActiveByMonth(clientId, year) {
      const from = `${year}-01-01`;
      const toExclusive = `${year + 1}-01-01`;
      const rows = db
        .prepare(
          `SELECT substr(work_date, 6, 2) AS m, COUNT(*) AS c
           FROM installations
           WHERE client_id = ? AND deleted_at IS NULL AND completed = 0
             AND work_date >= ? AND work_date < ?
           GROUP BY m`,
        )
        .all(clientId, from, toExclusive) as Array<{ m: string; c: number }>;
      const out: Record<number, number> = {};
      for (let i = 1; i <= 12; i++) out[i] = 0;
      for (const r of rows) {
        out[Number(r.m)] = r.c;
      }
      return out;
    },
    insert(row, searchBlob) {
      db.prepare(
        `INSERT INTO installations (
          id, client_id, title, summary, notes, work_date, due_date,
          price_minor, cost_minor, installation_minor, currency_code, currency_scale,
          completed, completed_at, revision, created_at, updated_at,
          deleted_at, deletion_batch_id, normalized_search
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.clientId,
        row.title,
        row.summary,
        row.notes,
        row.workDate,
        row.dueDate,
        row.priceMinor,
        row.costMinor,
        row.installationMinor,
        row.currencyCode,
        row.currencyScale,
        row.completed ? 1 : 0,
        row.completedAt,
        row.revision,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
        row.deletionBatchId,
        searchBlob,
      );
      const insStage = db.prepare(
        `INSERT INTO installation_stages (installation_id, stage_code, enabled) VALUES (?, ?, ?)`,
      );
      for (const code of STAGE_CODES) {
        insStage.run(row.id, code, row.stages[code] ? 1 : 0);
      }
      saveCustomValues(db, row.id, row.customValues);
    },
    update(row, searchBlob, expectedRevision) {
      const info = db
        .prepare(
          `UPDATE installations SET
            title = ?, summary = ?, notes = ?, work_date = ?, due_date = ?,
            price_minor = ?, cost_minor = ?, installation_minor = ?,
            completed = ?, completed_at = ?, revision = ?, updated_at = ?,
            normalized_search = ?
           WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        )
        .run(
          row.title,
          row.summary,
          row.notes,
          row.workDate,
          row.dueDate,
          row.priceMinor,
          row.costMinor,
          row.installationMinor,
          row.completed ? 1 : 0,
          row.completedAt,
          row.revision,
          row.updatedAt,
          searchBlob,
          row.id,
          expectedRevision,
        );
      if (info.changes !== 1) return false;
      for (const code of STAGE_CODES) {
        db.prepare(
          `UPDATE installation_stages SET enabled = ? WHERE installation_id = ? AND stage_code = ?`,
        ).run(row.stages[code] ? 1 : 0, row.id, code);
      }
      saveCustomValues(db, row.id, row.customValues);
      return true;
    },
    setStage(id, stage, enabled, expectedRevision, updatedAt) {
      const info = db
        .prepare(
          `UPDATE installations SET revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        )
        .run(updatedAt, id, expectedRevision);
      if (info.changes !== 1) return null;
      db.prepare(
        `UPDATE installation_stages SET enabled = ? WHERE installation_id = ? AND stage_code = ?`,
      ).run(enabled ? 1 : 0, id, stage);
      return this.findById(id);
    },
    setCompleted(id, completed, completedAt, expectedRevision, updatedAt) {
      const info = db
        .prepare(
          `UPDATE installations SET completed = ?, completed_at = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        )
        .run(completed ? 1 : 0, completedAt, updatedAt, id, expectedRevision);
      if (info.changes !== 1) return null;
      return this.findById(id);
    },
    softDelete(id, batchId, deletedAt, expectedRevision) {
      const info = db
        .prepare(
          `UPDATE installations SET deleted_at = ?, deletion_batch_id = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        )
        .run(deletedAt, batchId, deletedAt, id, expectedRevision);
      return info.changes === 1;
    },
    restore(id, restoredAt) {
      const info = db
        .prepare(
          `UPDATE installations SET deleted_at = NULL, deletion_batch_id = NULL, revision = revision + 1, updated_at = ?
           WHERE id = ? AND deleted_at IS NOT NULL`,
        )
        .run(restoredAt, id);
      return info.changes === 1;
    },
    listIdsForClient(clientId, activeOnly) {
      const rows = db
        .prepare(
          activeOnly
            ? `SELECT id FROM installations WHERE client_id = ? AND deleted_at IS NULL`
            : `SELECT id FROM installations WHERE client_id = ?`,
        )
        .all(clientId) as Array<{ id: string }>;
      return rows.map((r) => r.id);
    },
    listTrashed() {
      const rows = db
        .prepare(
          `SELECT i.*, c.kind AS client_kind, c.display_name AS client_display_name
           FROM installations i
           JOIN clients c ON c.id = i.client_id
           WHERE i.deleted_at IS NOT NULL
           ORDER BY i.deleted_at DESC, i.id`,
        )
        .all() as Array<
        InstRow & { client_kind: string; client_display_name: string }
      >;
      return rows.map((r) => ({
        ...mapInstallation(db, r),
        clientKind: r.client_kind as ClientKind,
        clientDisplayName: r.client_display_name,
      }));
    },
    query(params: InstallationQueryParams) {
      const where: string[] = ["i.deleted_at IS NULL"];
      const args: unknown[] = [];

      if (params.status === "active") where.push("i.completed = 0");
      if (params.status === "completed") where.push("i.completed = 1");
      if (params.kind) {
        where.push("c.kind = ?");
        args.push(params.kind);
      }
      if (params.clientId) {
        where.push("i.client_id = ?");
        args.push(params.clientId);
      }
      if (params.workFrom) {
        where.push("i.work_date >= ?");
        args.push(params.workFrom);
      }
      if (params.workTo) {
        where.push("i.work_date <= ?");
        args.push(params.workTo);
      }
      if (params.dueFrom) {
        where.push("i.due_date >= ?");
        args.push(params.dueFrom);
      }
      if (params.dueTo) {
        where.push("i.due_date <= ?");
        args.push(params.dueTo);
      }
      if (params.qNormalized) {
        where.push(`i.normalized_search LIKE ? ESCAPE '\\'`);
        args.push(`%${escapeLikeLiteral(params.qNormalized)}%`);
      }
      if (params.dueBucket === "none") {
        where.push("i.due_date IS NULL AND i.completed = 0");
      } else if (params.dueBucket === "overdue") {
        where.push("i.completed = 0 AND i.due_date IS NOT NULL AND i.due_date < ?");
        args.push(params.todayIso);
      } else if (params.dueBucket === "soon") {
        where.push(
          "i.completed = 0 AND i.due_date IS NOT NULL AND i.due_date >= ? AND i.due_date <= date(?, '+' || ? || ' days')",
        );
        args.push(params.todayIso, params.todayIso, params.soonThresholdDays);
      }

      if (params.stages) {
        for (const [code, mode] of Object.entries(params.stages)) {
          if (!mode || mode === "any") continue;
          where.push(
            `EXISTS (SELECT 1 FROM installation_stages s WHERE s.installation_id = i.id AND s.stage_code = ? AND s.enabled = ?)`,
          );
          args.push(code, mode === "on" ? 1 : 0);
        }
      }

      const orderMap = {
        due: "CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END, i.due_date",
        workDate: "i.work_date",
        title: "i.title COLLATE NOCASE",
        updatedAt: "i.updated_at",
      } as const;
      const dir = params.sortDir === "desc" ? "DESC" : "ASC";
      const orderSql = `${orderMap[params.sort]} ${dir}, i.id ASC`;

      const whereSql = where.join(" AND ");
      const totalRow = db
        .prepare(
          `SELECT COUNT(*) AS c FROM installations i
           JOIN clients c ON c.id = i.client_id
           WHERE ${whereSql}`,
        )
        .get(...args) as { c: number };

      const rows = db
        .prepare(
          `SELECT i.*, c.kind AS client_kind, c.display_name AS client_display_name
           FROM installations i
           JOIN clients c ON c.id = i.client_id
           WHERE ${whereSql}
           ORDER BY ${orderSql}
           LIMIT ? OFFSET ?`,
        )
        .all(...args, params.limit, params.offset) as Array<
        InstRow & { client_kind: string; client_display_name: string }
      >;

      const items: InstallationListItem[] = rows.map((r) => ({
        ...mapInstallation(db, r),
        clientKind: r.client_kind as ClientKind,
        clientDisplayName: r.client_display_name,
      }));

      return { items, total: totalRow.c };
    },
  };
}

export function createSettingsRepository(db: SqliteDb): SettingsRepository {
  return {
    getJson<T>(key: string) {
      const row = db
        .prepare(`SELECT version, value_json FROM ui_preferences WHERE key = ?`)
        .get(key) as { version: number; value_json: string } | undefined;
      if (!row) return null;
      return { version: row.version, value: JSON.parse(row.value_json) as T };
    },
    setJson<T>(key: string, version: number, value: T) {
      db.prepare(
        `INSERT INTO ui_preferences (key, version, value_json) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET version = excluded.version, value_json = excluded.value_json`,
      ).run(key, version, JSON.stringify(value));
    },
    getDefaultCurrency() {
      const code = db
        .prepare(`SELECT value FROM app_metadata WHERE key = 'currency_code'`)
        .get() as { value: string } | undefined;
      const scale = db
        .prepare(`SELECT value FROM app_metadata WHERE key = 'currency_scale'`)
        .get() as { value: string } | undefined;
      return {
        code: code?.value ?? "RUB",
        scale: scale ? Number(scale.value) : 2,
      };
    },
  };
}

export function createCustomFieldRepository(
  db: SqliteDb,
): CustomFieldRepository {
  return {
    listDefinitions(includeArchived) {
      const rows = db
        .prepare(
          includeArchived
            ? `SELECT * FROM custom_field_definitions ORDER BY sort_order, id`
            : `SELECT * FROM custom_field_definitions WHERE archived_at IS NULL ORDER BY sort_order, id`,
        )
        .all() as Array<{
        id: string;
        label: string;
        type: "text" | "multiline" | "number" | "date";
        sort_order: number;
        archived_at: string | null;
        revision: number;
      }>;
      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        type: r.type,
        sortOrder: r.sort_order,
        archivedAt: r.archived_at,
        revision: r.revision,
      }));
    },
    define(row) {
      db.prepare(
        `INSERT INTO custom_field_definitions
         (id, label, type, sort_order, archived_at, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
      ).run(
        row.id,
        row.label,
        row.type,
        row.sortOrder,
        row.revision,
        row.createdAt,
        row.updatedAt,
      );
    },
    archive(id, archivedAt, expectedRevision) {
      const info = db
        .prepare(
          `UPDATE custom_field_definitions
           SET archived_at = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ? AND archived_at IS NULL`,
        )
        .run(archivedAt, archivedAt, id, expectedRevision);
      return info.changes === 1;
    },
  };
}

const DEFAULT_LAYOUT: Array<{
  fieldKey: string;
  order: number;
  columnSpan: 3 | 6 | 12;
  height: number;
}> = [
  { fieldKey: "title", order: 0, columnSpan: 12, height: 2 },
  { fieldKey: "summary", order: 1, columnSpan: 12, height: 2 },
  { fieldKey: "workDate", order: 2, columnSpan: 6, height: 2 },
  { fieldKey: "dueDate", order: 3, columnSpan: 6, height: 2 },
  { fieldKey: "price", order: 4, columnSpan: 3, height: 2 },
  { fieldKey: "cost", order: 5, columnSpan: 3, height: 2 },
  { fieldKey: "installationCost", order: 6, columnSpan: 6, height: 2 },
  { fieldKey: "stages", order: 7, columnSpan: 6, height: 3 },
  { fieldKey: "completed", order: 8, columnSpan: 6, height: 2 },
  { fieldKey: "notes", order: 9, columnSpan: 12, height: 6 },
];

export function createLayoutRepository(db: SqliteDb): LayoutRepository {
  return {
    getLayout(scope) {
      const rows = db
        .prepare(
          `SELECT field_key, ord, column_span, height, layout_version
           FROM field_layouts WHERE layout_scope = ? ORDER BY ord`,
        )
        .all(scope) as Array<{
        field_key: string;
        ord: number;
        column_span: 3 | 6 | 12;
        height: number;
        layout_version: number;
      }>;
      if (rows.length === 0) {
        return DEFAULT_LAYOUT.map((f) => ({
          ...f,
          layoutVersion: 1,
        }));
      }
      return rows.map((r) => ({
        fieldKey: r.field_key,
        order: r.ord,
        columnSpan: r.column_span,
        height: r.height,
        layoutVersion: r.layout_version,
      }));
    },
    saveLayout(scope, layoutVersion, fields) {
      const trx = db.transaction(() => {
        db.prepare(`DELETE FROM field_layouts WHERE layout_scope = ?`).run(
          scope,
        );
        const ins = db.prepare(
          `INSERT INTO field_layouts (layout_scope, field_key, ord, column_span, height, layout_version)
           VALUES (?, ?, ?, ?, ?, ?)`,
        );
        for (const f of fields) {
          ins.run(
            scope,
            f.fieldKey,
            f.order,
            f.columnSpan,
            f.height,
            layoutVersion,
          );
        }
      });
      trx();
    },
    resetLayout(scope) {
      db.prepare(`DELETE FROM field_layouts WHERE layout_scope = ?`).run(scope);
    },
  };
}

export function createOperationStore(db: SqliteDb): OperationStore {
  return {
    find(operationId) {
      const row = db
        .prepare(
          `SELECT result_json FROM processed_operations WHERE operation_id = ?`,
        )
        .get(operationId) as { result_json: string } | undefined;
      return row ? { resultJson: row.result_json } : null;
    },
    save(operationId, resultJson, timestamp) {
      db.prepare(
        `INSERT OR IGNORE INTO processed_operations (operation_id, result_json, timestamp)
         VALUES (?, ?, ?)`,
      ).run(operationId, resultJson, timestamp);
    },
  };
}

export function createChangeLog(db: SqliteDb): ChangeLogPort {
  return {
    append(entry) {
      db.prepare(
        `INSERT INTO change_log (
          id, entity_type, entity_id, operation, changed_fields_json,
          before_json, after_json, timestamp, operation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        entry.id,
        entry.entityType,
        entry.entityId,
        entry.operation,
        entry.changedFieldsJson,
        entry.beforeJson,
        entry.afterJson,
        entry.timestamp,
        entry.operationId,
      );
    },
  };
}

type CostServiceRow = {
  id: string;
  category: string;
  name: string;
  price_minor: number;
  currency_code: string;
  currency_scale: number;
  sort_order: number;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapCostService(row: CostServiceRow): CostServiceRecord {
  if (!isCostCategory(row.category)) {
    throw new Error(`Некорректная категория услуги: ${row.category}`);
  }
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    priceMinor: row.price_minor,
    currencyCode: row.currency_code,
    currencyScale: row.currency_scale,
    sortOrder: row.sort_order,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function createCostServiceRepository(
  db: SqliteDb,
): CostServiceRepository {
  return {
    list(opts) {
      const category = opts?.category;
      const includeDeleted = opts?.includeDeleted === true;
      let sql = `SELECT * FROM cost_services`;
      const params: Array<string> = [];
      const where: string[] = [];
      if (!includeDeleted) where.push(`deleted_at IS NULL`);
      if (category) {
        where.push(`category = ?`);
        params.push(category);
      }
      if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
      sql += ` ORDER BY sort_order, name, id`;
      const rows = db.prepare(sql).all(...params) as CostServiceRow[];
      return rows.map(mapCostService);
    },
    findById(id, opts) {
      const row = db
        .prepare(`SELECT * FROM cost_services WHERE id = ?`)
        .get(id) as CostServiceRow | undefined;
      if (!row) return null;
      if (!opts?.includeDeleted && row.deleted_at) return null;
      return mapCostService(row);
    },
    insert(row) {
      db.prepare(
        `INSERT INTO cost_services (
          id, category, name, price_minor, currency_code, currency_scale,
          sort_order, revision, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      ).run(
        row.id,
        row.category,
        row.name,
        row.priceMinor,
        row.currencyCode,
        row.currencyScale,
        row.sortOrder,
        row.revision,
        row.createdAt,
        row.updatedAt,
      );
    },
    update(row, expectedRevision) {
      const info = db
        .prepare(
          `UPDATE cost_services
           SET name = ?, price_minor = ?, sort_order = ?,
               revision = ?, updated_at = ?
           WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        )
        .run(
          row.name,
          row.priceMinor,
          row.sortOrder,
          row.revision,
          row.updatedAt,
          row.id,
          expectedRevision,
        );
      return info.changes === 1;
    },
    softDelete(id, deletedAt, expectedRevision) {
      const info = db
        .prepare(
          `UPDATE cost_services
           SET deleted_at = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        )
        .run(deletedAt, deletedAt, id, expectedRevision);
      return info.changes === 1;
    },
  };
}
