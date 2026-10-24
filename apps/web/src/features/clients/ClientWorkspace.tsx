import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  displayNameFieldLabel,
  localIsoDateFromDate,
  type ClientKind,
} from "@workbook/domain";
import { apiClient, type ClientDto, type InstallationDto } from "../../api/client";
import { emitSaveStatus } from "../../app/App";
import { InstallationCard } from "../installations/InstallationCard";
import { DetailPanel } from "../installations/DetailPanel";
import styles from "../../styles/app.module.css";

const MONTHS = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

export function ClientWorkspace({ kind }: { kind: ClientKind }) {
  const { clientId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = localIsoDateFromDate(new Date());
  const [ty, tm] = today.split("-").map(Number) as [number, number];

  const year = Number(searchParams.get("year") ?? ty);
  const month = Number(searchParams.get("month") ?? tm);
  const installationId = searchParams.get("installation");

  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(installationId);

  const clientsQuery = useQuery({
    queryKey: ["clients", kind],
    queryFn: () => apiClient.listClients(kind),
  });

  const clients = useMemo(() => {
    const items = clientsQuery.data?.items ?? [];
    if (!q.trim()) return items;
    const n = q.toLowerCase();
    return items.filter(
      (c) =>
        c.displayName.toLowerCase().includes(n) ||
        (c.contactName ?? "").toLowerCase().includes(n) ||
        (c.phone ?? "").toLowerCase().includes(n),
    );
  }, [clientsQuery.data, q]);

  const selected =
    clients.find((c) => c.id === clientId) ??
    clients.find((c) => c.pinOrder === 1) ??
    clients.find((c) => c.pinOrder !== null) ??
    clients[0];

  useEffect(() => {
    if (!clientId && selected) {
      navigate(`/${kind}/${selected.id}?year=${year}&month=${month}`, {
        replace: true,
      });
    }
  }, [clientId, selected, kind, year, month, navigate]);

  const monthQuery = useQuery({
    queryKey: ["month", selected?.id, year, month, showCompleted],
    enabled: !!selected,
    queryFn: () =>
      apiClient.getMonth(selected!.id, year, month, showCompleted),
  });

  const createClient = useMutation({
    mutationFn: () =>
      apiClient.createClient({
        kind,
        displayName:
          kind === "corporate" ? "Новая организация" : "Новый клиент",
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["clients", kind] });
      navigate(`/${kind}/${row.id}?year=${year}&month=${month}`);
    },
  });

  const createInstallation = useMutation({
    mutationFn: () => {
      const workDate =
        year === ty && month === tm
          ? today
          : `${year}-${String(month).padStart(2, "0")}-01`;
      return apiClient.createInstallation({
        clientId: selected!.id,
        title: "Новый монтаж",
        workDate,
      });
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["month", selected?.id] });
      setDetailId(row.id);
      emitSaveStatus("Сохранено");
    },
  });

  function setPeriod(y: number, m: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("year", String(y));
      next.set("month", String(m));
      return next;
    });
  }

  if (clientsQuery.isLoading) {
    return <div className={styles.empty}>Загрузка клиентов…</div>;
  }

  return (
    <div className={styles.body}>
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}
        aria-label="Клиенты"
      >
        <div className={styles.sidebarHeader}>
          <button
            type="button"
            className={styles.btn}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "›" : "‹"} Панель
          </button>
          {!collapsed && (
            <>
              <strong>
                {kind === "corporate" ? "Корпоративные" : "Розница"}
              </strong>
              <input
                placeholder="Поиск"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Поиск клиентов"
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => createClient.mutate()}
              >
                + Клиент
              </button>
            </>
          )}
        </div>
        {!collapsed && (
          <div className={styles.sidebarList}>
            {clients.length === 0 ? (
              <div className={styles.empty}>
                <p>Пока нет клиентов.</p>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => createClient.mutate()}
                >
                  Добавить первого клиента
                </button>
              </div>
            ) : (
              clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.clientItem} ${c.id === selected?.id ? styles.clientItemActive : ""}`}
                  onClick={() =>
                    navigate(`/${kind}/${c.id}?year=${year}&month=${month}`)
                  }
                >
                  {c.pinOrder !== null && (
                    <span className={styles.pinIcon} title="Закреплён">
                      📌
                    </span>
                  )}
                  <span>{c.displayName}</span>
                </button>
              ))
            )}
          </div>
        )}
      </aside>

      <main className={styles.main}>
        {!selected ? (
          <div className={styles.empty}>Выберите или создайте клиента</div>
        ) : (
          <>
            <div className={styles.topRow}>
              <section className={styles.infoCard} aria-label="Общая информация">
                {editingClient ? (
                  <ClientEditForm
                    client={selected}
                    kind={kind}
                    onCancel={() => setEditingClient(false)}
                    onSaved={() => {
                      setEditingClient(false);
                      qc.invalidateQueries({ queryKey: ["clients", kind] });
                    }}
                  />
                ) : (
                  <>
                    <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>
                      {selected.displayName}
                    </h2>
                    <p style={{ margin: 0, color: "var(--muted)" }}>
                      {selected.contactName || "Контакт не указан"}
                    </p>
                    <p style={{ margin: "4px 0 12px" }}>{selected.phone || "—"}</p>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => setEditingClient(true)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      style={{ marginLeft: 8 }}
                      onClick={() =>
                        apiClient
                          .pinClient(selected.id, {
                            revision: selected.revision,
                            pinned: selected.pinOrder === null,
                            openByDefault: selected.pinOrder === null,
                          })
                          .then(() =>
                            qc.invalidateQueries({ queryKey: ["clients", kind] }),
                          )
                      }
                    >
                      {selected.pinOrder === null
                        ? "Закрепить"
                        : "Открепить"}
                    </button>
                  </>
                )}
              </section>

              <section className={styles.monthPanel} aria-label="Месяцы">
                <div className={styles.yearRow}>
                  <button
                    type="button"
                    className={styles.btn}
                    aria-label="Предыдущий год"
                    onClick={() => setPeriod(year - 1, month)}
                  >
                    ‹
                  </button>
                  <input
                    className="tabular"
                    style={{ width: 80 }}
                    value={year}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      if (y >= 1990 && y <= 2100) setPeriod(y, month);
                    }}
                    aria-label="Год"
                  />
                  <button
                    type="button"
                    className={styles.btn}
                    aria-label="Следующий год"
                    onClick={() => setPeriod(year + 1, month)}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setPeriod(ty, tm)}
                  >
                    Сегодня
                  </button>
                </div>
                <div className={styles.monthGrid}>
                  {MONTHS.map((label, idx) => {
                    const m = idx + 1;
                    const count = monthQuery.data?.monthCounts?.[m] ?? 0;
                    const isCurrent = year === ty && m === tm;
                    const isSelected = m === month;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`${styles.monthBtn} ${isCurrent ? styles.monthCurrent : ""} ${isSelected ? styles.monthSelected : ""}`}
                        onClick={() => setPeriod(year, m)}
                      >
                        <div>{label}</div>
                        <div className="tabular" style={{ color: "var(--muted)" }}>
                          {count}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className={styles.sectionHead}>
              <h1 className={styles.sectionTitle}>
                Монтажи · {MONTHS[month - 1]} {year}
              </h1>
              <span style={{ color: "var(--muted)" }}>
                {monthQuery.data?.installations.length ?? 0}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => createInstallation.mutate()}
              >
                + Монтаж
              </button>
              <label style={{ marginLeft: "auto", fontSize: "var(--fs-sm)" }}>
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                />{" "}
                Показывать выполненные
              </label>
            </div>

            <div className={styles.cards}>
              {(monthQuery.data?.installations.length ?? 0) === 0 ? (
                <div className={styles.empty}>
                  <p>В этом месяце пока нет монтажей</p>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => createInstallation.mutate()}
                  >
                    Добавить монтаж
                  </button>
                </div>
              ) : (
                monthQuery.data!.installations.map((inst) => (
                  <InstallationCard
                    key={inst.id}
                    installation={inst}
                    onOpen={() => setDetailId(inst.id)}
                    onChanged={() =>
                      qc.invalidateQueries({
                        queryKey: ["month", selected.id],
                      })
                    }
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>

      {detailId && selected && (
        <DetailPanel
          installationId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() =>
            qc.invalidateQueries({ queryKey: ["month", selected.id] })
          }
        />
      )}
    </div>
  );
}

function ClientEditForm({
  client,
  kind,
  onCancel,
  onSaved,
}: {
  client: ClientDto;
  kind: ClientKind;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(client.displayName);
  const [contactName, setContactName] = useState(client.contactName ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [status, setStatus] = useState("");

  async function save() {
    setStatus("Сохраняю…");
    emitSaveStatus("Сохраняю…");
    try {
      await apiClient.updateClient(client.id, {
        revision: client.revision,
        displayName,
        contactName,
        phone,
        notes,
      });
      const t = new Date();
      const stamp = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
      setStatus(`Сохранено в ${stamp}`);
      emitSaveStatus(`Сохранено в ${stamp}`);
      onSaved();
    } catch (e) {
      const msg =
        typeof e === "object" && e && "message" in e
          ? String((e as { message: string }).message)
          : "Ошибка сохранения";
      setStatus(msg);
      emitSaveStatus(`Не сохранено — повторить`);
    }
  }

  return (
    <div>
      <div className={styles.field}>
        <label>{displayNameFieldLabel(kind)}</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label>Контакт</label>
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label>Телефон</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label>Заметка</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>
          Сохранить
        </button>
        <button type="button" className={styles.btn} onClick={onCancel}>
          Отмена
        </button>
      </div>
      <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }} aria-live="polite">
        {status}
      </p>
    </div>
  );
}

// silence unused import warning for InstallationDto if any
void (null as unknown as InstallationDto);
