import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type ClientKind,
} from "@workbook/domain";
import type { AppPorts, ClientRecord } from "../ports.js";

function requireName(name: string): string {
  const t = name.trim();
  if (!t) throw new ValidationError("Название обязательно");
  if (t.length > 200) throw new ValidationError("Название слишком длинное");
  return t;
}

export function createClient(
  ports: AppPorts,
  input: {
    kind: ClientKind;
    displayName: string;
    contactName?: string | null;
    phone?: string | null;
    notes?: string | null;
    operationId?: string;
  },
): ClientRecord {
  if (input.operationId) {
    const existing = ports.operations.find(input.operationId);
    if (existing) return JSON.parse(existing.resultJson) as ClientRecord;
  }

  const now = ports.clock.nowIso();
  const row: ClientRecord = {
    id: ports.ids.nextId(),
    kind: input.kind,
    displayName: requireName(input.displayName),
    contactName: input.contactName?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes ?? null,
    pinOrder: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletionBatchId: null,
  };

  return ports.tx.runInTransaction(() => {
    ports.clients.insert(row);
    ports.changeLog.append({
      id: ports.ids.nextId(),
      entityType: "client",
      entityId: row.id,
      operation: "create",
      changedFieldsJson: JSON.stringify(["displayName", "kind"]),
      beforeJson: null,
      afterJson: JSON.stringify({ displayName: row.displayName, kind: row.kind }),
      timestamp: now,
      operationId: input.operationId ?? null,
    });
    if (input.operationId) {
      ports.operations.save(input.operationId, JSON.stringify(row), now);
    }
    return row;
  });
}

export function updateClient(
  ports: AppPorts,
  id: string,
  input: {
    revision: number;
    displayName?: string;
    contactName?: string | null;
    phone?: string | null;
    notes?: string | null;
    operationId?: string;
  },
): ClientRecord {
  if (input.operationId) {
    const existing = ports.operations.find(input.operationId);
    if (existing) return JSON.parse(existing.resultJson) as ClientRecord;
  }

  const current = ports.clients.findById(id);
  if (!current) throw new NotFoundError("Клиент не найден");

  const next: ClientRecord = {
    ...current,
    displayName:
      input.displayName !== undefined
        ? requireName(input.displayName)
        : current.displayName,
    contactName:
      input.contactName !== undefined
        ? input.contactName?.trim() || null
        : current.contactName,
    phone:
      input.phone !== undefined ? input.phone?.trim() || null : current.phone,
    notes: input.notes !== undefined ? input.notes : current.notes,
    revision: current.revision + 1,
    updatedAt: ports.clock.nowIso(),
  };

  return ports.tx.runInTransaction(() => {
    const ok = ports.clients.update(next, input.revision);
    if (!ok) {
      const fresh = ports.clients.findById(id);
      throw new ConflictError("Запись изменена в другом месте", {
        server: fresh,
        local: input,
      });
    }
    if (input.operationId) {
      ports.operations.save(
        input.operationId,
        JSON.stringify(next),
        next.updatedAt,
      );
    }
    return next;
  });
}

export function pinClient(
  ports: AppPorts,
  id: string,
  input: {
    revision: number;
    pinned: boolean;
    openByDefault?: boolean;
  },
): ClientRecord {
  const current = ports.clients.findById(id);
  if (!current) throw new NotFoundError("Клиент не найден");

  const siblings = ports.clients
    .listByKind(current.kind)
    .filter((c) => c.id !== id && c.pinOrder !== null)
    .sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0));

  let pinOrder: number | null = null;
  if (input.pinned) {
    if (input.openByDefault) {
      pinOrder = 1;
      // shift others
      ports.tx.runInTransaction(() => {
        for (const s of siblings) {
          const shifted = {
            ...s,
            pinOrder: (s.pinOrder ?? 0) + 1,
            revision: s.revision + 1,
            updatedAt: ports.clock.nowIso(),
          };
          ports.clients.update(shifted, s.revision);
        }
      });
    } else {
      const max = siblings.reduce((m, s) => Math.max(m, s.pinOrder ?? 0), 0);
      pinOrder = max + 1;
    }
  }

  const next: ClientRecord = {
    ...current,
    pinOrder,
    revision: current.revision + 1,
    updatedAt: ports.clock.nowIso(),
  };

  const ok = ports.clients.update(next, input.revision);
  if (!ok) throw new ConflictError("Запись изменена в другом месте");
  return next;
}

export function trashClient(ports: AppPorts, id: string): {
  batchId: string;
  affectedInstallations: number;
} {
  const current = ports.clients.findById(id);
  if (!current) throw new NotFoundError("Клиент не найден");

  const installationIds = ports.installations.listIdsForClient(id, true);
  const batchId = ports.ids.nextId();
  const deletedAt = ports.clock.nowIso();

  ports.tx.runInTransaction(() => {
    ports.clients.softDeleteBatch(id, batchId, deletedAt, installationIds);
  });

  return { batchId, affectedInstallations: installationIds.length };
}

export function restoreClientBatch(ports: AppPorts, batchId: string): number {
  return ports.tx.runInTransaction(() =>
    ports.clients.restoreBatch(batchId, ports.clock.nowIso()),
  );
}

export function listClients(ports: AppPorts, kind: ClientKind): ClientRecord[] {
  const rows = ports.clients.listByKind(kind);
  const pinned = rows
    .filter((r) => r.pinOrder !== null)
    .sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0));
  const rest = rows
    .filter((r) => r.pinOrder === null)
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "ru", { sensitivity: "base" }),
    );
  return [...pinned, ...rest];
}
