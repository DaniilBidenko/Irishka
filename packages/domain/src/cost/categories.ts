export const COST_CATEGORIES = [
  "polygraphy",
  "souvenirs",
  "outdoor",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  polygraphy: "Полиграфия",
  souvenirs: "Сувенирка",
  outdoor: "Наружка",
};

export function isCostCategory(value: string): value is CostCategory {
  return (COST_CATEGORIES as readonly string[]).includes(value);
}
