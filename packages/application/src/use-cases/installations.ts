import {
  ConflictError,
  NotFoundError,
  ValidationError,
  buildInstallationSearchBlob,
  emptyStages,
  isIsoDate,
  isStageCode,
  parseMoneyInput,
  type StageCode,
} from "@workbook/domain";
import type {
  AppPorts,
  InstallationListItem,
  InstallationQueryParams,
  InstallationRecord,
} from "../ports.js";

function parseOptionalMoney(
  label: string,
  raw: string | null | undefined,
  scale: number,
): number | null {
  if (raw === undefined) {
    throw new ValidationError(`Внутренняя ошибка поля ${label}`);
  }
  const parsed = parseMoneyInput(raw, scale);
  if (!parsed.ok) throw new ValidationError(`${label}: ${parsed.error}`);
  return parsed.minor;
}

export function createInstallation(
  ports: AppPorts,
  input: {
    clientId: string;
    title: string;
    summary?: string | null;
    workDate: string;
    dueDate?: string | null;
    priceInput?: string | null;
    costInput?: string | null;
    installationCostInput?: string | null;
    notes?: string | null;
    currencyCode?: string;
    allowDueBeforeWork?: boolean;
    operationId?: string;
  },
): InstallationRecord {
  if (input.operationId) {
    const existing = ports.operations.find(input.operationId);
    if (existing) return JSON.parse(existing.resultJson) as InstallationRecord;
  }

  const client = ports.clients.findById(input.clientId);
  if (!client) throw new NotFoundError("Клиент не найден");

  const title = input.title.trim();
  if (!title || title.length > 200) {
    throw new ValidationError("Название монтажа: 1–200 символов");
  }
  if (!isIsoDate(input.workDate)) {
    throw new ValidationError("Некорректная рабочая дата");
  }
  if (input.dueDate && !isIsoDate(input.dueDate)) {
    throw new ValidationError("Некорректный срок сдачи");
  }
  if (
    input.dueDate &&
    input.dueDate < input.workDate &&
    !input.allowDueBeforeWork
  ) {
    throw new ValidationError(
      "Срок раньше рабочей даты: подтвердите ввод истории",
      { code: "DUE_BEFORE_WORK" },
    );
  }

  const currency = input.currencyCode
    ? { code: input.currencyCode, scale: ports.settings.getDefaultCurrency().scale }
    : ports.settings.getDefaultCurrency();

  const now = ports.clock.nowIso();
  const row: InstallationRecord = {
    id: ports.ids.nextId(),
    clientId: input.clientId,
    title,
    summary: input.summary?.trim() || null,
    notes: input.notes ?? null,
    workDate: input.workDate,
    dueDate: input.dueDate ?? null,
    priceMinor:
      input.priceInput !== undefined
        ? parseOptionalMoney("Цена", input.priceInput, currency.scale)
        : null,
    costMinor:
      input.costInput !== undefined
        ? parseOptionalMoney("Себестоимость", input.costInput, currency.scale)
        : null,
    installationMinor:
      input.installationCostInput !== undefined
        ? parseOptionalMoney(
            "Монтаж, стоимость работ",
            input.installationCostInput,
            currency.scale,
          )
        : null,
    currencyCode: currency.code,
    currencyScale: currency.scale,
    completed: false,
    completedAt: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletionBatchId: null,
    stages: emptyStages(),
    customValues: {},
  };

  const searchBlob = buildInstallationSearchBlob({
    title: row.title,
    summary: row.summary ?? "",
    clientDisplayName: client.displayName,
  });

  return ports.tx.runInTransaction(() => {
    ports.installations.insert(row, searchBlob);
    if (input.operationId) {
      ports.operations.save(input.operationId, JSON.stringify(row), now);
    }
    return row;
  });
}

export function updateInstallation(
  ports: AppPorts,
  id: string,
  input: {
    revision: number;
    title?: string;
    summary?: string | null;
    workDate?: string;
    dueDate?: string | null;
    priceInput?: string | null;
    costInput?: string | null;
    installationCostInput?: string | null;
    notes?: string | null;
    allowDueBeforeWork?: boolean;
    customValues?: Record<string, string | number | null>;
    operationId?: string;
  },
): InstallationRecord {
  if (input.operationId) {
    const existing = ports.operations.find(input.operationId);
    if (existing) return JSON.parse(existing.resultJson) as InstallationRecord;
  }

  const current = ports.installations.findById(id);
  if (!current) throw new NotFoundError("Монтаж не найден");
  const client = ports.clients.findById(current.clientId);
  if (!client) throw new NotFoundError("Клиент не найден");

  const workDate = input.workDate ?? current.workDate;
  const dueDate =
    input.dueDate !== undefined ? input.dueDate : current.dueDate;
  if (input.workDate && !isIsoDate(input.workDate)) {
    throw new ValidationError("Некорректная рабочая дата");
  }
  if (dueDate && !isIsoDate(dueDate)) {
    throw new ValidationError("Некорректный срок сдачи");
  }
  if (dueDate && dueDate < workDate && !input.allowDueBeforeWork) {
    throw new ValidationError(
      "Срок раньше рабочей даты: подтвердите ввод истории",
      { code: "DUE_BEFORE_WORK" },
    );
  }

  const scale = current.currencyScale;
  const next: InstallationRecord = {
    ...current,
    title:
      input.title !== undefined ? input.title.trim() : current.title,
    summary:
      input.summary !== undefined
        ? input.summary?.trim() || null
        : current.summary,
    notes: input.notes !== undefined ? input.notes : current.notes,
    workDate,
    dueDate,
    priceMinor:
      input.priceInput !== undefined
        ? parseOptionalMoney("Цена", input.priceInput, scale)
        : current.priceMinor,
    costMinor:
      input.costInput !== undefined
        ? parseOptionalMoney("Себестоимость", input.costInput, scale)
        : current.costMinor,
    installationMinor:
      input.installationCostInput !== undefined
        ? parseOptionalMoney(
            "Монтаж, стоимость работ",
            input.installationCostInput,
            scale,
          )
        : current.installationMinor,
    customValues: input.customValues
      ? { ...current.customValues, ...input.customValues }
      : current.customValues,
    revision: current.revision + 1,
    updatedAt: ports.clock.nowIso(),
  };

  if (!next.title || next.title.length > 200) {
    throw new ValidationError("Название монтажа: 1–200 символов");
  }

  const searchBlob = buildInstallationSearchBlob({
    title: next.title,
    summary: next.summary ?? "",
    clientDisplayName: client.displayName,
  });

  return ports.tx.runInTransaction(() => {
    const ok = ports.installations.update(next, searchBlob, input.revision);
    if (!ok) {
      throw new ConflictError("Запись изменена в другом месте", {
        server: ports.installations.findById(id),
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

export function setStage(
  ports: AppPorts,
  id: string,
  input: {
    revision: number;
    stage: string;
    enabled: boolean;
    operationId?: string;
  },
): InstallationRecord {
  if (input.operationId) {
    const existing = ports.operations.find(input.operationId);
    if (existing) return JSON.parse(existing.resultJson) as InstallationRecord;
  }
  if (!isStageCode(input.stage)) {
    throw new ValidationError("Неизвестный этап");
  }
  const stage = input.stage as StageCode;

  return ports.tx.runInTransaction(() => {
    const updated = ports.installations.setStage(
      id,
      stage,
      input.enabled,
      input.revision,
      ports.clock.nowIso(),
    );
    if (!updated) {
      const current = ports.installations.findById(id);
      if (!current) throw new NotFoundError("Монтаж не найден");
      throw new ConflictError("Запись изменена в другом месте", {
        server: current,
      });
    }
    if (input.operationId) {
      ports.operations.save(
        input.operationId,
        JSON.stringify(updated),
        updated.updatedAt,
      );
    }
    return updated;
  });
}

export function setCompleted(
  ports: AppPorts,
  id: string,
  input: { revision: number; completed: boolean; operationId?: string },
): InstallationRecord {
  if (input.operationId) {
    const existing = ports.operations.find(input.operationId);
    if (existing) return JSON.parse(existing.resultJson) as InstallationRecord;
  }

  const completedAt = input.completed ? ports.clock.nowIso() : null;

  return ports.tx.runInTransaction(() => {
    const updated = ports.installations.setCompleted(
      id,
      input.completed,
      completedAt,
      input.revision,
      ports.clock.nowIso(),
    );
    if (!updated) {
      const current = ports.installations.findById(id);
      if (!current) throw new NotFoundError("Монтаж не найден");
      throw new ConflictError("Запись изменена в другом месте", {
        server: current,
      });
    }
    if (input.operationId) {
      ports.operations.save(
        input.operationId,
        JSON.stringify(updated),
        updated.updatedAt,
      );
    }
    return updated;
  });
}

export function trashInstallation(
  ports: AppPorts,
  id: string,
  revision: number,
): void {
  const batchId = ports.ids.nextId();
  const ok = ports.tx.runInTransaction(() =>
    ports.installations.softDelete(
      id,
      batchId,
      ports.clock.nowIso(),
      revision,
    ),
  );
  if (!ok) {
    const current = ports.installations.findById(id);
    if (!current) throw new NotFoundError("Монтаж не найден");
    throw new ConflictError("Запись изменена в другом месте");
  }
}

export function restoreInstallation(ports: AppPorts, id: string): void {
  const ok = ports.installations.restore(id, ports.clock.nowIso());
  if (!ok) throw new NotFoundError("Запись в корзине не найдена");
}

export function getClientMonth(
  ports: AppPorts,
  clientId: string,
  year: number,
  month: number,
  includeCompleted: boolean,
): { installations: InstallationRecord[]; monthCounts: Record<number, number> } {
  const { monthRange } = requireMonthRange();
  const { from, toExclusive } = monthRange(year, month);
  return {
    installations: ports.installations.listForClientMonth(
      clientId,
      from,
      toExclusive,
      includeCompleted,
    ),
    monthCounts: ports.installations.countActiveByMonth(clientId, year),
  };
}

function requireMonthRange() {
  // lazy import-style to keep domain pure usage
  return {
    monthRange: (
      year: number,
      month: number,
    ): { from: string; toExclusive: string } => {
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      let ny = year;
      let nm = month + 1;
      if (nm > 12) {
        nm = 1;
        ny += 1;
      }
      return {
        from,
        toExclusive: `${ny}-${String(nm).padStart(2, "0")}-01`,
      };
    },
  };
}

export function queryInstallations(
  ports: AppPorts,
  params: Omit<InstallationQueryParams, "todayIso" | "soonThresholdDays"> & {
    soonThresholdDays?: number;
  },
): { items: InstallationListItem[]; total: number } {
  const prefs = ports.settings.getJson<{ soonThresholdDays?: number }>(
    "deadline",
  );
  return ports.installations.query({
    ...params,
    soonThresholdDays:
      params.soonThresholdDays ?? prefs?.value.soonThresholdDays ?? 2,
    todayIso: ports.clock.todayLocalIsoDate(),
  });
}
