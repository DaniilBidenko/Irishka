export const STAGE_CODES = ["CRM", "YOU", "MON", "SO", "PP", "UR"] as const;
export type StageCode = (typeof STAGE_CODES)[number];

/** Порядок UI: верх CRM · YOU · МОНТ, низ СО · ПП · УР */
export const STAGE_GRID: readonly [StageCode, StageCode, StageCode][] = [
  ["CRM", "YOU", "MON"],
  ["SO", "PP", "UR"],
];

export const STAGE_LABELS: Record<StageCode, string> = {
  CRM: "CRM",
  YOU: "YOU",
  MON: "МОНТ",
  SO: "СО",
  PP: "ПП",
  UR: "УР",
};

/** Включённый фон этапа */
export const STAGE_COLORS: Record<StageCode, string> = {
  CRM: "#426C91",
  YOU: "#C45B8C",
  MON: "#1A1A1A",
  SO: "#7BA87A",
  PP: "#D9772F",
  UR: "#C0392B",
};

/** Выключенный: светлая подложка того же оттенка */
export const STAGE_SOFT_COLORS: Record<StageCode, string> = {
  CRM: "#E8F0F5",
  YOU: "#F8E8F0",
  MON: "#EBEBEB",
  SO: "#E8F2E7",
  PP: "#F8EDE3",
  UR: "#F8E8E6",
};

export const STAGE_SOFT_TEXT: Record<StageCode, string> = {
  CRM: "#355A78",
  YOU: "#8A3D62",
  MON: "#333333",
  SO: "#3F5F3E",
  PP: "#8A4E1C",
  UR: "#8B2A22",
};

export type StagesMap = Record<StageCode, boolean>;

export function emptyStages(): StagesMap {
  return {
    CRM: false,
    YOU: false,
    MON: false,
    SO: false,
    PP: false,
    UR: false,
  };
}

export function isStageCode(v: string): v is StageCode {
  return (STAGE_CODES as readonly string[]).includes(v);
}
