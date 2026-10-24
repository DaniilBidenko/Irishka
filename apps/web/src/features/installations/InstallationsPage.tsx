import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { InstallationCard } from "./InstallationCard";
import { DetailPanel } from "./DetailPanel";
import styles from "../../styles/app.module.css";

export function InstallationsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"active" | "completed" | "all">(
    "active",
  );
  const [kind, setKind] = useState<"" | "corporate" | "retail">("");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const qs = new URLSearchParams();
  if (debounced) qs.set("q", debounced);
  qs.set("status", status);
  if (kind) qs.set("kind", kind);
  qs.set("limit", "50");
  qs.set("sort", "due");

  const list = useQuery({
    queryKey: ["installations", qs.toString()],
    queryFn: () => apiClient.queryInstallations(qs.toString()),
  });

  return (
    <div className={styles.body}>
      <main className={styles.main} style={{ width: "100%" }}>
        <div className={styles.sectionHead}>
          <h1 className={styles.sectionTitle}>Монтажи</h1>
          <span style={{ color: "var(--muted)" }}>
            найдено {list.data?.total ?? 0}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <input
            placeholder="Поиск"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Поиск монтажей"
            style={{ minWidth: 220 }}
          />
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "active" | "completed" | "all")
            }
            aria-label="Статус"
          >
            <option value="active">Активные</option>
            <option value="completed">Выполненные</option>
            <option value="all">Все</option>
          </select>
          <select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as "" | "corporate" | "retail")
            }
            aria-label="Тип клиента"
          >
            <option value="">Все клиенты</option>
            <option value="corporate">Корпоративные</option>
            <option value="retail">Розница</option>
          </select>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setQ("");
              setStatus("active");
              setKind("");
            }}
          >
            Сбросить
          </button>
        </div>

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
              <button
                type="button"
                className={styles.btn}
                style={{ marginTop: 4 }}
                onClick={() => {
                  const d = new Date(inst.workDate);
                  navigate(
                    `/${inst.clientKind}/${inst.clientId}?year=${d.getFullYear()}&month=${d.getMonth() + 1}&installation=${inst.id}`,
                  );
                }}
              >
                К клиенту
              </button>
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
