import { randomUUID } from "node:crypto";
import type { AppPorts } from "@workbook/application";
import { localIsoDateFromDate } from "@workbook/domain";
import type { SqliteDb } from "./sqlite/connection.js";
import {
  createChangeLog,
  createClientRepository,
  createCustomFieldRepository,
  createInstallationRepository,
  createLayoutRepository,
  createOperationStore,
  createSettingsRepository,
  createTransactionPort,
} from "./sqlite/repositories.js";

export function composePorts(db: SqliteDb): AppPorts {
  return {
    ids: { nextId: () => randomUUID() },
    clock: {
      nowIso: () => new Date().toISOString(),
      todayLocalIsoDate: () => localIsoDateFromDate(new Date()),
    },
    tx: createTransactionPort(db),
    clients: createClientRepository(db),
    installations: createInstallationRepository(db),
    settings: createSettingsRepository(db),
    customFields: createCustomFieldRepository(db),
    layouts: createLayoutRepository(db),
    operations: createOperationStore(db),
    changeLog: createChangeLog(db),
  };
}
