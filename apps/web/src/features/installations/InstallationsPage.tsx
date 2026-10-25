import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { STAGE_CODES, STAGE_LABELS, type StageCode } from "@workbook/domain";
import { apiClient } from "../../api/client";
import { Button, SearchField, Select } from "../../components";
import { InstallationCard } from "./InstallationCard";
import { DetailPanel } from "./DetailPanel";
import styles from "../../styles/app.module.css";

type StageFilter = "any" | "on" | "off";

export function InstallationsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"active" | "completed" | "all">(
    "active",
  );
  const [kind, setKind] = useState<"" | "corporate" | "retail">("");
  const [dueBucket, setDueBucket] = useState<"" | "none" | "soon" | "overdue">(
    "",
  );
  const [stageFilters, setStageFilters] = useState<
    Partial<Record<StageCode, StageFilter>>
  >({});
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const qs = new URLSearchParams();
  if (debounced) qs.set("q", debounced);
  qs.set("status", status);
  if (kind) qs.set("kind", kind);
  if (dueBucket) qs.set("dueBucket", dueBucket);
  for (const code of STAGE_CODES) {
    const mode = stageFilters[code];
    if (mode && mode !== "any") {
      qs.set(`stage${code}`, mode);
    }
  }
  qs.set("limit", "50");
  qs.set("sort", "due");

  const list = useQuery({
    queryKey: ["installations", qs.toString()],
    queryFn: () => apiClient.queryInstallations(qs.toString()),
  });

  const activeFilters: string[] = [];
  if (debounced) activeFilters.push(`поиск: ${debounced}`);
  if (status !== "active") activeFilters.push(`статус: ${status}`);
  if (kind)
    activeFilters.push(kind === "corporate" ? "корпоративные" : "розница");
  if (dueBucket) activeFilters.push(`срок: ${dueBucket}`);
  for (const code of STAGE_CODES) {
    const mode = stageFilters[code];
    if (mode && mode !== "any") {
      activeFilters.push(
        `${STAGE_LABELS[code]}: ${mode === "on" ? "вкл" : "выкл"}`,
      );
    }
  }

  function reset() {
    setQ("");
    setStatus("active");
    setKind("");
    setDueBucket("");
    setStageFilters({});
  }

  return (
    <div className={styles.body}>
      <main className={styles.main} style={{ width: "100%" }}>
        <div className={styles.sectionHead}>
          <h1 className={styles.sectionTitle}>Монтажи</h1>
          <span className={styles.sectionMeta}>
            найдено {list.data?.total ?? 0}
          </span>
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.filterItem} style={{ maxWidth: 280, flex: "1 1 220px" }}>
            <SearchField
              placeholder="Поиск"
              value={q}
              onValueChange={setQ}
              aria-label="Поиск монтажей"
            />
          </div>
          <div className={styles.filterItem}>
            <Select
              aria-label="Статус"
              value={status}
              onChange={(v) =>
                setStatus(v as "active" | "completed" | "all")
              }
              options={[
                { value: "active", label: "Активные" },
                { value: "completed", label: "Выполненные" },
                { value: "all", label: "Все" },
              ]}
            />
          </div>
          <div className={styles.filterItem}>
            <Select
              aria-label="Тип клиента"
              value={kind}
              onChange={(v) =>
                setKind(v as "" | "corporate" | "retail")
              }
              options={[
                { value: "", label: "Все клиенты" },
                { value: "corporate", label: "Корпоративные" },
                { value: "retail", label: "Розница" },
              ]}
            />
          </div>
          <div className={styles.filterItem}>
            <Select
              aria-label="Срок"
              value={dueBucket}
              onChange={(v) =>
                setDueBucket(v as "" | "none" | "soon" | "overdue")
              }
              options={[
                { value: "", label: "Любой срок" },
                { value: "none", label: "Без срока" },
                { value: "soon", label: "Через 1–2 дн." },
                { value: "overdue", label: "Просроченные" },
              ]}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            Сбросить
          </Button>
        </div>

        <div className={styles.filtersRow} aria-label="Фильтры этапов">
          {STAGE_CODES.map((code) => (
            <div key={code} className={styles.filterItem} style={{ maxWidth: 140 }}>
              <Select
                label={STAGE_LABELS[code]}
                aria-label={`Этап ${STAGE_LABELS[code]}`}
                value={stageFilters[code] ?? "any"}
                onChange={(v) =>
                  setStageFilters((prev) => ({
                    ...prev,
                    [code]: v as StageFilter,
                  }))
                }
                options={[
                  { value: "any", label: "любой" },
                  { value: "on", label: "вкл" },
                  { value: "off", label: "выкл" },
                ]}
              />
            </div>
          ))}
        </div>

        {activeFilters.length > 0 && (
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
            Активные фильтры: {activeFilters.join(" · ")}
          </p>
        )}

        <div className={styles.cards}>
          {list.isLoading && <div className={styles.empty}>Загрузка…</div>}
          {list.data && list.data.items.length === 0 && (
            <div className={styles.empty}>Ничего не найдено</div>
          )}
          {list.data?.items.map((inst) => (
            <div key={inst.id}>
              <InstallationCard
                installation={inst}
                showClient
                onOpen={() => setDetailId(inst.id)}
                onChanged={() => list.refetch()}
              />
              <div style={{ marginTop: 8 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const d = new Date(inst.workDate + "T12:00:00");
                    navigate(
                      `/${inst.clientKind}/${inst.clientId}?year=${d.getFullYear()}&month=${d.getMonth() + 1}&installation=${inst.id}`,
                    );
                  }}
                >
                  К клиенту
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {detailId && (
        <DetailPanel
          installationId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => list.refetch()}
        />
      )}
    </div>
  );
}
