import { describe, expect, it } from "vitest";
import { calendarDaysBetween, computeDeadlineStatus } from "./deadlineStatus.js";

describe("deadlines", () => {
  it("границы дней", () => {
    const today = "2026-03-10";
    expect(computeDeadlineStatus({ dueDate: null, completed: false, todayIso: today }).kind).toBe("none");
    expect(computeDeadlineStatus({ dueDate: "2026-03-14", completed: false, todayIso: today, soonThresholdDays: 3 }).kind).toBe("ok");
    expect(computeDeadlineStatus({ dueDate: "2026-03-13", completed: false, todayIso: today, soonThresholdDays: 3 }).kind).toBe("soon");
    expect(computeDeadlineStatus({ dueDate: "2026-03-12", completed: false, todayIso: today, soonThresholdDays: 3 }).kind).toBe("soon");
    expect(computeDeadlineStatus({ dueDate: "2026-03-11", completed: false, todayIso: today }).kind).toBe("tomorrow");
    expect(computeDeadlineStatus({ dueDate: "2026-03-10", completed: false, todayIso: today }).kind).toBe("today");
    expect(computeDeadlineStatus({ dueDate: "2026-03-09", completed: false, todayIso: today }).kind).toBe("overdue");
  });

  it("завершён не просрочен", () => {
    const s = computeDeadlineStatus({
      dueDate: "2020-01-01",
      completed: true,
      todayIso: "2026-03-10",
    });
    expect(s.kind).toBe("done");
  });

  it("leap year", () => {
    expect(calendarDaysBetween("2024-02-28", "2024-03-01")).toBe(2);
  });
});
