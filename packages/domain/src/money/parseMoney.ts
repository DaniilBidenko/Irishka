/** Деньги в минимальных единицах (minor). Пусто ≠ ноль. Без float. */

export type MoneyParseResult =
  | { ok: true; minor: number | null }
  | { ok: false; error: string };

const MAX_SAFE_MINOR = Number.MAX_SAFE_INTEGER;

/**
 * Разбирает десятичный ввод (точка или запятая) в minor units.
 * scale — число дробных знаков валюты (обычно 2).
 */
export function parseMoneyInput(
  raw: string | null | undefined,
  scale: number,
): MoneyParseResult {
  if (raw === null || raw === undefined) {
    return { ok: true, minor: null };
  }
  const trimmed = String(raw).trim();
  if (trimmed === "") {
    return { ok: true, minor: null };
  }
  if (scale < 0 || scale > 6 || !Number.isInteger(scale)) {
    return { ok: false, error: "Недопустимый масштаб валюты" };
  }
  if (/[eE]/.test(trimmed)) {
    return { ok: false, error: "Научная запись не допускается" };
  }
  if (trimmed.startsWith("-")) {
    return { ok: false, error: "Отрицательные суммы не допускаются" };
  }

  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: "Некорректный формат суммы" };
  }

  const [intPart, fracPart = ""] = normalized.split(".");
  if (fracPart.length > scale) {
    return {
      ok: false,
      error: `Не больше ${scale} знаков после запятой`,
    };
  }
  const paddedFrac = fracPart.padEnd(scale, "0");
  const digits = intPart + paddedFrac;
  // Leading zeros ok; BigInt avoids float
  let minor: number;
  try {
    const asBig = BigInt(digits);
    if (asBig > BigInt(MAX_SAFE_MINOR)) {
      return { ok: false, error: "Сумма слишком велика" };
    }
    minor = Number(asBig);
  } catch {
    return { ok: false, error: "Некорректный формат суммы" };
  }
  if (!Number.isSafeInteger(minor)) {
    return { ok: false, error: "Сумма слишком велика" };
  }
  return { ok: true, minor };
}

export function formatMoneyMinor(
  minor: number | null,
  scale: number,
): string {
  if (minor === null) return "";
  if (scale === 0) return String(minor);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const s = String(abs).padStart(scale + 1, "0");
  const intPart = s.slice(0, -scale) || "0";
  const frac = s.slice(-scale);
  return `${negative ? "-" : ""}${intPart},${frac}`;
}
