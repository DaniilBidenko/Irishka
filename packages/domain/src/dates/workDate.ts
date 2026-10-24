const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Полуоткрытый диапазон месяца [first, nextFirst) */
export function monthRange(
  year: number,
  month: number,
): { from: string; toExclusive: string } {
  if (month < 1 || month > 12) {
    throw new Error("month must be 1..12");
  }
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  let ny = year;
  let nm = month + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const toExclusive = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return { from, toExclusive };
}

export function defaultWorkDateForMonth(
  year: number,
  month: number,
  todayIso: string,
): string {
  const [ty, tm] = todayIso.split("-").map(Number) as [number, number];
  if (ty === year && tm === month) {
    return todayIso;
  }
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
