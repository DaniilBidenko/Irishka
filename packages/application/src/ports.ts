import type { ClientKind, StageCode, StagesMap } from "@workbook/domain";

export type ClientRecord = {
  id: string;
  kind: ClientKind;
  displayName: string;
  contactName: string | null;
  phone: string | null;
  notes: string | null;
  pinOrder: number | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletionBatchId: string | null;
};

export type InstallationRecord = {
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
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletionBatchId: string | null;
  stages: StagesMap;
  customValues: Record<string, string | number | null>;
};

export type InstallationListItem = InstallationRecord & {
  clientKind: ClientKind;
  clientDisplayName: string;
};

export type IdGenerator = { nextId: () => string };
export type ClockPort = {
  nowIso: () => string;
  todayLocalIsoDate: () => string;
};

export type TransactionPort = {
  runInTransaction: <T>(fn: () => T) => T;
};

export type ClientRepository = {
  findById: (id: string, opts?: { includeDeleted?: boolean }) => ClientRecord | null;
  listByKind: (kind: ClientKind) => ClientRecord[];
  insert: (row: ClientRecord) => void;
  update: (row: ClientRecord, expectedRevision: number) => boolean;
  softDeleteBatch: (
    clientId: string,
    batchId: string,
    deletedAt: string,
    installationIds: string[],
  ) => { clientRevision: number };
  restoreBatch: (batchId: string, restoredAt: string) => number;
};

export type InstallationRepository = {
  findById: (
    id: string,
    opts?: { includeDeleted?: boolean },
  ) => InstallationRecord | null;
  listForClientMonth: (
    clientId: string,
    from: string,
    toExclusive: string,
    includeCompleted: boolean,
  ) => InstallationRecord[];
  countActiveByMonth: (
    clientId: string,
    year: number,
  ) => Record<number, number>;
  insert: (row: InstallationRecord, searchBlob: string) => void;
  update: (
    row: InstallationRecord,
    searchBlob: string,
    expectedRevision: number,
  ) => boolean;
  setStage: (
    id: string,
    stage: StageCode,
    enabled: boolean,
    expectedRevision: number,
    updatedAt: string,
  ) => InstallationRecord | null;
  setCompleted: (
    id: string,
    completed: boolean,
    completedAt: string | null,
    expectedRevision: number,
    updatedAt: string,
  ) => InstallationRecord | null;
  softDelete: (
    id: string,
    batchId: string,
    deletedAt: string,
    expectedRevision: number,
  ) => boolean;
  restore: (id: string, restoredAt: string) => boolean;
  query: (params: InstallationQueryParams) => {
    items: InstallationListItem[];
    total: number;
  };
  listIdsForClient: (clientId: string, activeOnly: boolean) => string[];
};

export type InstallationQueryParams = {
  qNormalized?: string;
  kind?: ClientKind;
  clientId?: string;
  workFrom?: string;
  workTo?: string;
  dueFrom?: string;
  dueTo?: string;
  status: "active" | "completed" | "all";
  dueBucket?: "none" | "soon" | "overdue";
  soonThresholdDays: number;
  todayIso: string;
  stages?: Partial<Record<StageCode, "any" | "on" | "off">>;
  sort: "due" | "workDate" | "title" | "updatedAt";
  sortDir: "asc" | "desc";
  limit: number;
  offset: number;
};

export type SettingsRepository = {
  getJson: <T>(key: string) => { version: number; value: T } | null;
  setJson: <T>(key: string, version: number, value: T) => void;
  getDefaultCurrency: () => { code: string; scale: number };
};

export type CustomFieldRepository = {
  listDefinitions: (includeArchived?: boolean) => Array<{
    id: string;
    label: string;
    type: "text" | "multiline" | "number" | "date";
    sortOrder: number;
    archivedAt: string | null;
    revision: number;
  }>;
  define: (row: {
    id: string;
    label: string;
    type: "text" | "multiline" | "number" | "date";
    sortOrder: number;
    revision: number;
    createdAt: string;
    updatedAt: string;
  }) => void;
  archive: (id: string, archivedAt: string, expectedRevision: number) => boolean;
};

export type LayoutRepository = {
  getLayout: (scope: "main" | "compact") => Array<{
    fieldKey: string;
    order: number;
    columnSpan: 3 | 6 | 12;
    height: number;
    layoutVersion: number;
  }>;
  saveLayout: (
    scope: "main" | "compact",
    layoutVersion: number,
    fields: Array<{
      fieldKey: string;
      order: number;
      columnSpan: 3 | 6 | 12;
      height: number;
    }>,
  ) => void;
  resetLayout: (scope: "main" | "compact") => void;
};

export type OperationStore = {
  find: (operationId: string) => { resultJson: string } | null;
  save: (operationId: string, resultJson: string, timestamp: string) => void;
};

export type ChangeLogPort = {
  append: (entry: {
    id: string;
    entityType: string;
    entityId: string;
    operation: string;
    changedFieldsJson: string;
    beforeJson: string | null;
    afterJson: string | null;
    timestamp: string;
    operationId: string | null;
  }) => void;
};

export type BackupPort = {
  createBackup: (reason: string) => Promise<{
    path: string;
    sha256: string;
    createdAt: string;
  }>;
  restoreBackup: (filePath: string, confirmed: boolean) => Promise<void>;
};

export type AppPorts = {
  ids: IdGenerator;
  clock: ClockPort;
  tx: TransactionPort;
  clients: ClientRepository;
  installations: InstallationRepository;
  settings: SettingsRepository;
  customFields: CustomFieldRepository;
  layouts: LayoutRepository;
  operations: OperationStore;
  changeLog: ChangeLogPort;
};
