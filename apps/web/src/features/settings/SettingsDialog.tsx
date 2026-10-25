import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { Button, Select, TextField } from "../../components";
import ui from "../../components/ui.module.css";
import { TrashPanel } from "../trash/TrashPanel";
import styles from "../../styles/app.module.css";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"general" | "fields" | "trash">("general");
  const [msg, setMsg] = useState("");
  const [fontSize, setFontSize] = useState(
    document.documentElement.dataset.fontSize === "large" ? "large" : "normal",
  );
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<
    "text" | "multiline" | "number" | "date"
  >("text");

  const fields = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => apiClient.listCustomFields(),
    enabled: tab === "fields",
  });

  function applyFont(size: string) {
    setFontSize(size);
    if (size === "large") {
      document.documentElement.dataset.fontSize = "large";
    } else {
      delete document.documentElement.dataset.fontSize;
    }
    void apiClient
      .setPreference("ui", 1, { fontSize: size })
      .catch(() => undefined);
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

  async function addField() {
    if (!newLabel.trim()) return;
    await apiClient.defineCustomField({
      label: newLabel.trim(),
      type: newType,
    });
    setNewLabel("");
    await qc.invalidateQueries({ queryKey: ["custom-fields"] });
  }

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside
        className={styles.drawer}
        style={{ width: 520, minWidth: 320 }}
        role="dialog"
        aria-modal="true"
        aria-label="Настройки"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Настройки</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className={ui.tabsRow} role="tablist" aria-label="Разделы настроек">
          {(
            [
              ["general", "Общие"],
              ["fields", "Поля"],
              ["trash", "Корзина"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`${ui.tabChip} ${tab === id ? ui.tabChipActive : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <>
            <Select
              label="Размер шрифта"
              value={fontSize}
              onChange={applyFont}
              options={[
                { value: "normal", label: "Обычный" },
                { value: "large", label: "Крупный" },
              ]}
            />

            <div className={ui.field}>
              <span className={ui.fieldLabel}>Резервная копия</span>
              <div className={ui.btnRow}>
                <Button variant="secondary" onClick={() => void backup()}>
                  Создать копию
                </Button>
              </div>
              <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
                {msg ||
                  "Также: автокопия при первом запуске дня и каждые 30 мин при изменениях."}
              </p>
            </div>

            {import.meta.env.DEV && (
              <div className={ui.field}>
                <span className={ui.fieldLabel}>Разработка</span>
                <Button variant="secondary" onClick={() => void seedDev()}>
                  Заполнить демо-данные (только DEV)
                </Button>
              </div>
            )}
          </>
        )}

        {tab === "fields" && (
          <div>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
              Дополнительные поля общие для монтажей. Удаление — архив; значения
              сохраняются.
            </p>
            <div
              className={ui.btnRow}
              style={{ marginBottom: 12, alignItems: "flex-end" }}
            >
              <div style={{ flex: "1 1 160px", minWidth: 140 }}>
                <TextField
                  label="Имя поля"
                  placeholder="Имя поля"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div style={{ flex: "0 1 160px", minWidth: 140 }}>
                <Select
                  label="Тип"
                  value={newType}
                  onChange={(v) =>
                    setNewType(
                      v as "text" | "multiline" | "number" | "date",
                    )
                  }
                  options={[
                    { value: "text", label: "Текст" },
                    { value: "multiline", label: "Многострочный" },
                    { value: "number", label: "Число" },
                    { value: "date", label: "Дата" },
                  ]}
                />
              </div>
              <Button
                variant="primary"
                style={{ marginBottom: 14 }}
                onClick={() => void addField()}
              >
                Добавить
              </Button>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {(fields.data?.items ?? [])
                .filter((f) => !f.archivedAt)
                .map((f) => (
                  <li
                    key={f.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span>
                      {f.label}{" "}
                      <span style={{ color: "var(--muted)" }}>({f.type})</span>
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        void apiClient
                          .archiveCustomField(f.id, f.revision)
                          .then(() =>
                            qc.invalidateQueries({
                              queryKey: ["custom-fields"],
                            }),
                          )
                      }
                    >
                      В архив
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {tab === "trash" && <TrashPanel />}
      </aside>
    </>
  );
}

async function seedDev() {
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
