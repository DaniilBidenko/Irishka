import { describe, expect, it } from "vitest";
import { formatMoneyMinor, parseMoneyInput } from "./parseMoney.js";

describe("parseMoneyInput", () => {
  it("пусто отличается от нуля", () => {
    expect(parseMoneyInput("", 2)).toEqual({ ok: true, minor: null });
    expect(parseMoneyInput("0", 2)).toEqual({ ok: true, minor: 0 });
    expect(parseMoneyInput("0,00", 2)).toEqual({ ok: true, minor: 0 });
  });

  it("принимает запятую и точку", () => {
    expect(parseMoneyInput("12,34", 2)).toEqual({ ok: true, minor: 1234 });
    expect(parseMoneyInput("12.34", 2)).toEqual({ ok: true, minor: 1234 });
  });

  it("запрещает лишние знаки и отрицательные", () => {
    expect(parseMoneyInput("1,234", 2).ok).toBe(false);
    expect(parseMoneyInput("-1", 2).ok).toBe(false);
  });

  it("не использует float-ошибки", () => {
    expect(parseMoneyInput("0,1", 2)).toEqual({ ok: true, minor: 10 });
    expect(parseMoneyInput("0,01", 2)).toEqual({ ok: true, minor: 1 });
    expect(formatMoneyMinor(10, 2)).toBe("0,10");
  });
});
