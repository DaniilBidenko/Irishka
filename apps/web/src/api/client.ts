import type { ClientKind, CostCategory, StageCode } from "@workbook/domain";

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
};

let csrfToken: string | null = null;

export async function ensureSession(): Promise<{
  csrfToken: string;
  instanceId: string;
  appVersion: string;
  currency: { code: string; scale: number };
}> {
  const res = await fetch("/api/v1/session", { credentials: "include" });
  if (!res.ok) throw new Error("Не удалось получить сессию");
  const data = (await res.json()) as {
    csrfToken: string;
    instanceId: string;
    appVersion: string;
    currency: { code: string; scale: number };
  };
  csrfToken = data.csrfToken;
  return data;
}

async function api<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  if (!csrfToken && method !== "GET") {
    await ensureSession();
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (method !== "GET" && method !== "HEAD") {
    headers["X-CSRF-Token"] = csrfToken ?? "";
  }
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let err: ApiError;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      err = {
        code: "HTTP",
        message: `Ошибка ${res.status}`,
        requestId: "",
      };
    }
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type ClientDto = {
  id: string;
  kind: ClientKind;
  displayName: string;
  contactName: string | null;
  phone: string | null;
  notes: string | null;
  pinOrder: number | null;
  revision: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  deletionBatchId?: string | null;
};

export type CustomFieldDto = {
  id: string;
  label: string;
  type: "text" | "multiline" | "number" | "date";
  sortOrder: number;
  archivedAt: string | null;
  revision: number;
};

export type CostServiceDto = {
  id: string;
  category: CostCategory;
  name: string;
  priceMinor: number;
  currencyCode: string;
  currencyScale: number;
  sortOrder: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type InstallationDto = {
  id: string;
  clientId: string;
  title: string;
  summary: string | null;
  notes: string | null;
  workDate: string;
  dueDate: string | null;
  priceMinor: number | null;
  costMinor: number | null;
  installationMinor: number | null;
  currencyCode: string;
  currencyScale: number;
  completed: boolean;
  completedAt: string | null;
  revision: number;
  stages: Record<StageCode, boolean>;
  customValues: Record<string, string | number | null>;
  clientKind?: ClientKind;
  clientDisplayName?: string;
};

export const apiClient = {
  listClients: (kind: ClientKind) =>
    api<{ items: ClientDto[] }>("GET", `/api/v1/clients?kind=${kind}`),
  createClient: (body: unknown) =>
    api<ClientDto>("POST", "/api/v1/clients", body),
  updateClient: (id: string, body: unknown) =>
    api<ClientDto>("PATCH", `/api/v1/clients/${id}`, body),
  pinClient: (id: string, body: unknown) =>
    api<ClientDto>("POST", `/api/v1/clients/${id}/pin`, body),
  trashClient: (id: string) =>
    api<{ batchId: string; affectedInstallations: number }>(
      "POST",
      `/api/v1/clients/${id}/trash`,
      {},
    ),
  getMonth: (
    clientId: string,
    year: number,
    month: number,
    includeCompleted: boolean,
  ) =>
    api<{
      installations: InstallationDto[];
      monthCounts: Record<number, number>;
    }>(
      "GET",
      `/api/v1/clients/${clientId}/month?year=${year}&month=${month}&includeCompleted=${includeCompleted ? 1 : 0}`,
    ),
  createInstallation: (body: unknown) =>
    api<InstallationDto>("POST", "/api/v1/installations", body),
  updateInstallation: (id: string, body: unknown) =>
    api<InstallationDto>("PATCH", `/api/v1/installations/${id}`, body),
  setStage: (
    id: string,
    body: { revision: number; stage: StageCode; enabled: boolean },
  ) => api<InstallationDto>("POST", `/api/v1/installations/${id}/stages`, body),
  setCompleted: (
    id: string,
    body: { revision: number; completed: boolean },
  ) =>
    api<InstallationDto>(
      "POST",
      `/api/v1/installations/${id}/completed`,
      body,
    ),
  trashInstallation: (id: string, revision: number) =>
    api<{ ok: boolean }>("POST", `/api/v1/installations/${id}/trash`, {
      revision,
    }),
  restoreInstallation: (id: string) =>
    api<{ ok: boolean }>("POST", `/api/v1/installations/${id}/restore`, {}),
  queryInstallations: (qs: string) =>
    api<{ items: InstallationDto[]; total: number }>(
      "GET",
      `/api/v1/installations?${qs}`,
    ),
  listTrash: () =>
    api<{ clients: ClientDto[]; installations: InstallationDto[] }>(
      "GET",
      "/api/v1/trash",
    ),
  restoreBatch: (batchId: string) =>
    api<{ restored: number }>("POST", "/api/v1/trash/restore-batch", {
      batchId,
    }),
  listCustomFields: () =>
    api<{ items: CustomFieldDto[] }>("GET", "/api/v1/custom-fields"),
  defineCustomField: (body: {
    label: string;
    type: "text" | "multiline" | "number" | "date";
  }) => api<CustomFieldDto>("POST", "/api/v1/custom-fields", body),
  archiveCustomField: (id: string, revision: number) =>
    api<{ ok: boolean }>("POST", `/api/v1/custom-fields/${id}/archive`, {
      revision,
    }),
  listCostServices: (category?: CostCategory) =>
    api<{ items: CostServiceDto[] }>(
      "GET",
      category
        ? `/api/v1/cost-services?category=${category}`
        : "/api/v1/cost-services",
    ),
  createCostService: (body: {
    category: CostCategory;
    name: string;
    priceInput: string;
  }) => api<CostServiceDto>("POST", "/api/v1/cost-services", body),
  updateCostService: (
    id: string,
    body: { revision: number; name?: string; priceInput?: string },
  ) => api<CostServiceDto>("PATCH", `/api/v1/cost-services/${id}`, body),
  trashCostService: (id: string, revision: number) =>
    api<{ ok: boolean }>("POST", `/api/v1/cost-services/${id}/trash`, {
      revision,
    }),
  createBackup: () =>
    api<{ path: string; createdAt: string }>("POST", "/api/v1/backups", {}),
  getPreference: <T>(key: string) =>
    api<{ version: number; value: T }>("GET", `/api/v1/preferences/${key}`),
  setPreference: (key: string, version: number, value: unknown) =>
    api<{ ok: boolean }>("PUT", `/api/v1/preferences/${key}`, {
      version,
      value,
    }),
};
