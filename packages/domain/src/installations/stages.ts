export const STAGE_CODES = ["CRM", "YOU", "PP", "MON", "GV", "SO"] as const;
export type StageCode = (typeof STAGE_CODES)[number];

/** Порядок UI: верх CRM·YOU·ПП, низ МОН·ГВ·СО */
export const STAGE_GRID: readonly [StageCode, StageCode, StageCode][] = [
  ["CRM", "YOU", "PP"],
  ["MON", "GV", "SO"],
];

export const STAGE_LABELS: Record<StageCode, string> = {
  CRM: "CRM",
  YOU: "YOU",
  PP: "ПП",
  MON: "МОН",
  GV: "ГВ",
  SO: "СО",
};

export const STAGE_COLORS: Record<StageCode, string> = {
  CRM: "#315D82",
  YOU: "#675184",
  PP: "#7B5C20",
  MON: "#236B66",
  GV: "#436A35",
  SO: "#8D455D",
};

export type StagesMap = Record<StageCode, boolean>;

export function emptyStages(): StagesMap {
  return {
    CRM: false,
    YOU: false,
    PP: false,
    MON: false,
    GV: false,
    SO: false,
  };
}

export function isStageCode(v: string): v is StageCode {
  return (STAGE_CODES as readonly string[]).includes(v);
}
