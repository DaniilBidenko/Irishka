import { useState } from "react";
import { apiClient } from "../../api/client";
import styles from "../../styles/app.module.css";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [fontSize, setFontSize] = useState(
    document.documentElement.dataset.fontSize === "large" ? "large" : "normal",
  );

  function applyFont(size: string) {
    setFontSize(size);
    if (size === "large") {
      document.documentElement.dataset.fontSize = "large";
    } else {
      delete document.documentElement.dataset.fontSize;
    }
  }

  async function backup() {
    setMsg("Создаю копию…");
    try {
      const r = await apiClient.createBackup();
      setMsg(`Копия создана: ${r.createdAt}`);
    } catch (e) {
      setMsg(
        typeof e === "object" && e && "message" in e
          ? String((e as { message: string }).message)
          : "Ошибка резервного копирования",
      );
    }
  }

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside
        className={styles.drawer}
        style={{ width: 480, minWidth: 320 }}
        role="dialog"
        aria-modal="true"
        aria-label="Настройки"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0 }}>Настройки</h2>
          <button type="button" className={styles.btn} onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className={styles.field}>
          <label>Размер шрифта</label>
          <select
            value={fontSize}
            onChange={(e) => applyFont(e.target.value)}
          >
            <option value="normal">Обычный</option>
            <option value="large">Крупный</option>
          </select>
        </div>

        <div className={styles.field}>
          <label>Резервная копия</label>
          <button type="button" className={styles.btn} onClick={() => void backup()}>
            Создать копию
          </button>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
            {msg ||
              "Копии хранятся в папке данных приложения, вне репозитория."}
          </p>
        </div>

        {import.meta.env.DEV && (
          <div className={styles.field}>
            <label>Разработка</label>
            <button
              type="button"
              className={styles.btn}
              onClick={() => void seedDev()}
            >
              Заполнить демо-данные (только DEV)
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

async function seedDev() {
  const { apiClient } = await import("../../api/client");
  const corp = await apiClient.createClient({
    kind: "corporate",
    displayName: "Студия Север",
    contactName: "Алексей",
  });
  await apiClient.createClient({
    kind: "corporate",
    displayName: "Мастерская Лист",
  });
  await apiClient.createClient({
    kind: "retail",
    displayName: "Ирина К.",
    phone: "+7 (900) 000-00-00",
  });
  const today = new Date().toISOString().slice(0, 10);
  await apiClient.createInstallation({
    clientId: corp.id,
    title: "Вывеска на фасад",
    summary: "Монтаж световой вывески",
    workDate: today,
  });
  await apiClient.createInstallation({
    clientId: corp.id,
    title: "Оклейка витрины",
    workDate: today,
  });
  window.location.reload();
}
