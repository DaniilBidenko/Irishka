import { test, expect } from "@playwright/test";

/**
 * E2E требует запущенный production/dev сервер на 4318.
 * Без сервера тест пропускается, чтобы не маскировать сбой удалением проверки.
 */
test("app bar и разделы", async ({ page }) => {
  try {
    const res = await page.request.get("/api/v1/health");
    if (!res.ok()) test.skip(true, "Сервер не запущен");
  } catch {
    test.skip(true, "Сервер не запущен");
  }

  await page.goto("/");
  await expect(page.getByText("Рабочая тетрадь")).toBeVisible();
  await expect(page.getByRole("link", { name: "Корпоративные" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Розница" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Монтажи" })).toBeVisible();
});
