import { describe, expect, it } from "vitest";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  isCostCategory,
} from "./categories.js";

describe("cost categories", () => {
  it("три фиксированные категории с русскими подписями", () => {
    expect(COST_CATEGORIES).toEqual(["polygraphy", "souvenirs", "outdoor"]);
    expect(COST_CATEGORY_LABELS.polygraphy).toBe("Полиграфия");
    expect(COST_CATEGORY_LABELS.souvenirs).toBe("Сувенирка");
    expect(COST_CATEGORY_LABELS.outdoor).toBe("Наружка");
  });

  it("isCostCategory", () => {
    expect(isCostCategory("polygraphy")).toBe(true);
    expect(isCostCategory("other")).toBe(false);
  });
});
