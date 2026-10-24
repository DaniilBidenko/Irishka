import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import { ensureSession } from "../api/client";
import { ClientWorkspace } from "../features/clients/ClientWorkspace";
import { InstallationsPage } from "../features/installations/InstallationsPage";
import { SettingsDialog } from "../features/settings/SettingsDialog";
import styles from "../styles/app.module.css";

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState("Готово к работе");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    ensureSession()
      .then(() => setReady(true))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Сервер недоступен"),
      );
  }, []);

  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setSaveHint(detail);
    };
    window.addEventListener("workbook:save-status", onStatus);
    return () => window.removeEventListener("workbook:save-status", onStatus);
  }, []);

  if (error) {
    return (
      <div className={styles.empty}>
        <p>{error}</p>
        <p>Запустите тетрадь ярлыком или командой npm run app:start / npm run dev.</p>
      </div>
    );
  }

  if (!ready) {
    return <div className={styles.empty}>Загрузка…</div>;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.appBar}>
        <div className={styles.brand}>Рабочая тетрадь</div>
        <nav className={styles.tabs} aria-label="Разделы">
          <NavLink
            to="/corporate"
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.tabActive : ""}`
            }
          >
            Корпоративные
          </NavLink>
          <NavLink
            to="/retail"
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.tabActive : ""}`
            }
          >
            Розница
          </NavLink>
          <NavLink
            to="/installations"
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.tabActive : ""}`
            }
          >
            Монтажи
          </NavLink>
        </nav>
        <div className={styles.appBarRight}>
          <span aria-live="polite">{saveHint}</span>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setSettingsOpen(true)}
          >
            Настройки
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Navigate to="/corporate" replace />} />
        <Route
          path="/corporate/:clientId?"
          element={<ClientWorkspace kind="corporate" />}
        />
        <Route
          path="/retail/:clientId?"
          element={<ClientWorkspace kind="retail" />}
        />
        <Route path="/installations" element={<InstallationsPage />} />
      </Routes>
      {settingsOpen && (
        <SettingsDialog onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

export function emitSaveStatus(text: string) {
  window.dispatchEvent(
    new CustomEvent("workbook:save-status", { detail: text }),
  );
}
