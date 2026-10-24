import type { AppPorts } from "../ports.js";

export function saveLayout(
  ports: AppPorts,
  input: {
    layoutScope: "main" | "compact";
    layoutVersion: number;
    fields: Array<{
      fieldKey: string;
      order: number;
      columnSpan: 3 | 6 | 12;
      height: number;
    }>;
  },
): void {
  ports.layouts.saveLayout(
    input.layoutScope,
    input.layoutVersion,
    input.fields,
  );
}

export function getLayout(ports: AppPorts, scope: "main" | "compact") {
  return ports.layouts.getLayout(scope);
}

export function resetLayout(ports: AppPorts, scope: "main" | "compact"): void {
  ports.layouts.resetLayout(scope);
}

export function defineCustomField(
  ports: AppPorts,
  input: {
    label: string;
    type: "text" | "multiline" | "number" | "date";
    operationId?: string;
  },
) {
  const defs = ports.customFields.listDefinitions(true);
  const sortOrder = defs.length;
  const now = ports.clock.nowIso();
  const row = {
    id: ports.ids.nextId(),
    label: input.label.trim(),
    type: input.type,
    sortOrder,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  ports.customFields.define(row);
  return { ...row, archivedAt: null as string | null };
}

export function archiveCustomField(
  ports: AppPorts,
  id: string,
  revision: number,
): void {
  const ok = ports.customFields.archive(
    id,
    ports.clock.nowIso(),
    revision,
  );
  if (!ok) {
    throw new Error("Поле не найдено или конфликт версии");
  }
}
