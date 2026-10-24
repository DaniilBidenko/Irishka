/** Статус срока сдачи по календарным дням локальной зоны. Даты — YYYY-MM-DD. */

export type DeadlineKind =
  | "none"
  | "ok"
  | "soon"
  | "tomorrow"
  | "today"
  | "overdue"
  | "done";

export type DeadlineStatus = {
  kind: DeadlineKind;
  label: string;
  /** CSS-токен / роль цвета */
  tone:
    | "muted"
    | "ok"
    | "warn"
    | "danger"
    | "dangerStrong"
    | "done";
  daysRemaining: number | null;
};

export type Clock = { todayLocalIsoDate: () => string };

/** Разница календарных дней: due - today. Без UTC-конвертации дат. */
export function calendarDaysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = toIso.split("-").map(Number) as [number, number, number];
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

export function computeDeadlineStatus(input: {
  dueDate: string | null;
  completed: boolean;
  completedAtDate?: string | null;
  soonThresholdDays?: number;
  todayIso: string;
}): DeadlineStatus {
  const soon = input.soonThresholdDays ?? 3;

  if (input.completed) {
    return {
      kind: "done",
      label: "Выполнено",
      tone: "done",
      daysRemaining: input.dueDate
        ? calendarDaysBetween(input.todayIso, input.dueDate)
        : null,
    };
  }

  if (!input.dueDate) {
    return {
      kind: "none",
      label: "Без срока",
      tone: "muted",
      daysRemaining: null,
    };
  }

  const days = calendarDaysBetween(input.todayIso, input.dueDate);

  if (days > soon) {
    return {
      kind: "ok",
      label: `Осталось ${days} дн.`,
      tone: "ok",
      daysRemaining: days,
    };
  }
  if (days >= 2 && days <= soon) {
    return {
      kind: "soon",
      label: `Скоро · ${days} дн.`,
      tone: "warn",
      daysRemaining: days,
    };
  }
  if (days === 1) {
    return {
      kind: "tomorrow",
      label: "Завтра",
      tone: "danger",
      daysRemaining: 1,
    };
  }
  if (days === 0) {
    return {
      kind: "today",
      label: "Сегодня",
      tone: "danger",
      daysRemaining: 0,
    };
  }
  const overdue = Math.abs(days);
  return {
    kind: "overdue",
    label: `Просрочено на ${overdue} дн.`,
    tone: "dangerStrong",
    daysRemaining: days,
  };
}

export function localIsoDateFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function systemClock(): Clock {
  return { todayLocalIsoDate: () => localIsoDateFromDate(new Date()) };
}
