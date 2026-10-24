import { z } from "zod";

export const ClientKindSchema = z.enum(["corporate", "retail"]);
export const StageCodeSchema = z.enum(["CRM", "YOU", "PP", "MON", "GV", "SO"]);

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ожидается дата YYYY-MM-DD");

export const CreateClientSchema = z.object({
  kind: ClientKindSchema,
  displayName: z.string().trim().min(1).max(200),
  contactName: z.string().max(200).optional().nullable(),
  phone: z.string().max(80).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  operationId: z.string().uuid().optional(),
});

export const UpdateClientSchema = z.object({
  revision: z.number().int().positive(),
  displayName: z.string().trim().min(1).max(200).optional(),
  contactName: z.string().max(200).nullable().optional(),
  phone: z.string().max(80).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  operationId: z.string().uuid().optional(),
});

export const PinClientSchema = z.object({
  revision: z.number().int().positive(),
  pinned: z.boolean(),
  openByDefault: z.boolean().optional(),
  operationId: z.string().uuid().optional(),
});

export const CreateInstallationSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(1000).optional().nullable(),
  workDate: IsoDateSchema,
  dueDate: IsoDateSchema.nullable().optional(),
  priceInput: z.string().nullable().optional(),
  costInput: z.string().nullable().optional(),
  installationCostInput: z.string().nullable().optional(),
  notes: z.string().max(100000).optional().nullable(),
  currencyCode: z.string().min(3).max(8).optional(),
  allowDueBeforeWork: z.boolean().optional(),
  operationId: z.string().uuid().optional(),
});

export const UpdateInstallationSchema = z.object({
  revision: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().max(1000).nullable().optional(),
  workDate: IsoDateSchema.optional(),
  dueDate: IsoDateSchema.nullable().optional(),
  priceInput: z.string().nullable().optional(),
  costInput: z.string().nullable().optional(),
  installationCostInput: z.string().nullable().optional(),
  notes: z.string().max(100000).nullable().optional(),
  allowDueBeforeWork: z.boolean().optional(),
  customValues: z
    .record(z.string(), z.union([z.string(), z.number(), z.null()]))
    .optional(),
  operationId: z.string().uuid().optional(),
});

export const SetStageSchema = z.object({
  revision: z.number().int().positive(),
  stage: StageCodeSchema,
  enabled: z.boolean(),
  operationId: z.string().uuid().optional(),
});

export const SetCompletedSchema = z.object({
  revision: z.number().int().positive(),
  completed: z.boolean(),
  operationId: z.string().uuid().optional(),
});

export const QueryInstallationsSchema = z.object({
  q: z.string().optional(),
  kind: ClientKindSchema.optional(),
  clientId: z.string().uuid().optional(),
  workFrom: IsoDateSchema.optional(),
  workTo: IsoDateSchema.optional(),
  dueFrom: IsoDateSchema.optional(),
  dueTo: IsoDateSchema.optional(),
  status: z.enum(["active", "completed", "all"]).optional(),
  dueBucket: z
    .enum(["none", "soon", "overdue"])
    .optional(),
  stages: z
    .record(StageCodeSchema, z.enum(["any", "on", "off"]))
    .optional(),
  sort: z
    .enum(["due", "workDate", "title", "updatedAt"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const DefineCustomFieldSchema = z.object({
  label: z.string().trim().min(1).max(100),
  type: z.enum(["text", "multiline", "number", "date"]),
  operationId: z.string().uuid().optional(),
});

export const SaveLayoutSchema = z.object({
  layoutScope: z.enum(["main", "compact"]),
  layoutVersion: z.number().int().positive(),
  fields: z.array(
    z.object({
      fieldKey: z.string().min(1).max(64),
      order: z.number().int().min(0),
      columnSpan: z.union([z.literal(3), z.literal(6), z.literal(12)]),
      height: z.number().int().min(1).max(40),
    }),
  ),
});

export const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
export type CreateInstallationInput = z.infer<typeof CreateInstallationSchema>;
export type UpdateInstallationInput = z.infer<typeof UpdateInstallationSchema>;
export type QueryInstallationsInput = z.infer<typeof QueryInstallationsSchema>;
