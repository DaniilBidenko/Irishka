import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import { ensureSession } from "../api/client";
import { ClientWorkspace } from "../features/clients/ClientWorkspace";
import { ContactsPage } from "../features/contacts/ContactsPage";
import { CostCatalogPage } from "../features/cost/CostCatalogPage";
import { InstallationsPage } from "../features/installations/InstallationsPage";
import { Button } from "../components";
import { SettingsDialog } from "../features/settings/SettingsDialog";
import { subscribeMutations } from "../lib/sync";
import styles from "../styles/app.module.css";

export function App() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState("Готово к работе");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devSandbox, setDevSandbox] = useState(false);

  useEffect(() => {
    ensureSession()
      .then(async () => {
        try {
          const res = await fetch("/api/v1/health", { credentials: "include" });
          if (res.ok) {
            const h = (await res.json()) as { devSandbox?: boolean };
            setDevSandbox(Boolean(h.devSandbox));
          }
        } catch {
          /* ignore */
        }
        setReady(true);
      })
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

  useEffect(() => {
    const unsub = subscribeMutations(() => {
      void qc.invalidateQueries();
    });
    function onFocus() {
      void qc.invalidateQueries();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
    };
  }, [qc]);

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
          <NavLink
            to="/contacts"
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.tabActive : ""}`
            }
          >
            Контакты
          </NavLink>
          <NavLink
            to="/cost"
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.tabActive : ""}`
            }
          >
            Себестоимость
          </NavLink>
        </nav>
        <div className={styles.appBarRight}>
          {devSandbox ? (
            <span className={styles.devBadge} title="Данные во временной папке .tmp — не для рабочих записей">
              DEV · временные данные
            </span>
          ) : null}
          <span aria-live="polite">{saveHint}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            Настройки
          </Button>
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
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/cost" element={<CostCatalogPage />} />
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
