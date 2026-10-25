import {
  ConflictError,
  NotFoundError,
  ValidationError,
  isCostCategory,
  parseMoneyInput,
  type CostCategory,
} from "@workbook/domain";
import type { AppPorts, CostServiceRecord } from "../ports.js";

function parseRequiredMoney(
  label: string,
  raw: string,
  scale: number,
): number {
  const parsed = parseMoneyInput(raw, scale);
  if (!parsed.ok) throw new ValidationError(`${label}: ${parsed.error}`);
  if (parsed.minor === null) {
    throw new ValidationError(`${label}: укажите сумму`);
  }
  return parsed.minor;
}

function requireName(name: string): string {
  const t = name.trim();
  if (!t) throw new ValidationError("Название услуги обязательно");
  if (t.length > 200) throw new ValidationError("Название слишком длинное");
  return t;
}

export function listCostServices(
  ports: AppPorts,
  opts?: { category?: CostCategory },
): CostServiceRecord[] {
  if (opts?.category && !isCostCategory(opts.category)) {
    throw new ValidationError("Неизвестная категория");
  }
  return ports.costServices.list({ category: opts?.category });
}

export function createCostService(
  ports: AppPorts,
  input: {
    category: string;
    name: string;
    priceInput: string;
    operationId?: string;
  },
): CostServiceRecord {
  if (input.operationId) {
    const existing = ports.operations.find(input.operationId);
    if (existing) {
      return JSON.parse(existing.resultJson) as CostServiceRecord;
    }
  }
  if (!isCostCategory(input.category)) {
    throw new ValidationError("Неизвестная категория");
  }
  const currency = ports.settings.getDefaultCurrency();
  const name = requireName(input.name);
  const priceMinor = parseRequiredMoney(
    "Цена",
    input.priceInput,
    currency.scale,
  );
  const now = ports.clock.nowIso();
  const existing = ports.costServices.list({ category: input.category });
  const sortOrder =
    existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
  const row: CostServiceRecord = {
    id: ports.ids.nextId(),
    category: input.category,
    name,
    priceMinor,
    currencyCode: currency.code,
    currencyScale: currency.scale,
    sortOrder,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  ports.tx.runInTransaction(() => {
    ports.costServices.insert(row);
    if (input.operationId) {
      ports.operations.save(
        input.operationId,
        JSON.stringify(row),
        now,
      );
    }
  });
  return row;
}

export function updateCostService(
  ports: AppPorts,
  id: string,
  input: {
    revision: number;
    name?: string;
    priceInput?: string;
  },
): CostServiceRecord {
  const current = ports.costServices.findById(id);
  if (!current) throw new NotFoundError("Услуга не найдена");
  if (current.revision !== input.revision) {
    throw new ConflictError("Запись изменена в другом месте", {
      server: current,
    });
  }
  const name =
    input.name !== undefined ? requireName(input.name) : current.name;
  const priceMinor =
    input.priceInput !== undefined
      ? parseRequiredMoney(
          "Цена",
          input.priceInput,
          current.currencyScale,
        )
      : current.priceMinor;
  const now = ports.clock.nowIso();
  const next: CostServiceRecord = {
    ...current,
    name,
    priceMinor,
    revision: current.revision + 1,
    updatedAt: now,
  };
  const ok = ports.costServices.update(next, input.revision);
  if (!ok) {
    const again = ports.costServices.findById(id);
    if (!again) throw new NotFoundError("Услуга не найдена");
    throw new ConflictError("Запись изменена в другом месте", {
      server: again,
    });
  }
  return next;
}

export function trashCostService(
  ports: AppPorts,
  id: string,
  revision: number,
): void {
  const current = ports.costServices.findById(id);
  if (!current) throw new NotFoundError("Услуга не найдена");
  if (current.revision !== revision) {
    throw new ConflictError("Запись изменена в другом месте", {
      server: current,
    });
  }
  const ok = ports.costServices.softDelete(
    id,
    ports.clock.nowIso(),
    revision,
  );
  if (!ok) {
    const again = ports.costServices.findById(id);
    if (!again) throw new NotFoundError("Услуга не найдена");
    throw new ConflictError("Запись изменена в другом месте", {
      server: again,
    });
  }
}
