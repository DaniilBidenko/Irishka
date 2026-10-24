import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatMoneyMinor, parseMoneyInput } from "@workbook/domain";
import { apiClient, type InstallationDto } from "../../api/client";
import { emitSaveStatus } from "../../app/App";
import { clearDraft, loadDraft, saveDraft } from "../../lib/drafts";
import styles from "../../styles/app.module.css";

export function DetailPanel({
  installationId,
  onClose,
  onChanged,
}: {
  installationId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const q = useQuery({
    queryKey: ["installation", installationId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/installations/${installationId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Не удалось загрузить монтаж");
      return (await res.json()) as InstallationDto;
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (dirtyRef.current) {
          const leave = window.confirm(
            "Есть несохранённые изменения. Закрыть?",
          );
          if (!leave) return;
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dirtyRef = useRef(false);

  if (q.isLoading) {
    return (
      <>
        <div className={styles.drawerBackdrop} onClick={onClose} />
        <aside className={styles.drawer}>Загрузка…</aside>
      </>
    );
  }

  if (q.isError || !q.data) {
    return (
      <>
        <div className={styles.drawerBackdrop} onClick={onClose} />
        <aside className={styles.drawer}>
          <p>Запись недоступна. Возможно, она в корзине.</p>
          <button type="button" className={styles.btn} onClick={onClose}>
            Закрыть
          </button>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-modal="true">
        <Editor
          initial={q.data}
          dirtyRef={dirtyRef}
          onClose={onClose}
          onChanged={() => {
            q.refetch();
            onChanged();
          }}
        />
      </aside>
    </>
  );
}

function Editor({
  initial,
  dirtyRef,
  onClose,
  onChanged,
}: {
  initial: InstallationDto;
  dirtyRef: React.MutableRefObject<boolean>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [revision, setRevision] = useState(initial.revision);
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [workDate, setWorkDate] = useState(initial.workDate);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [price, setPrice] = useState(
    formatMoneyMinor(initial.priceMinor, initial.currencyScale),
  );
  const [cost, setCost] = useState(
    formatMoneyMinor(initial.costMinor, initial.currencyScale),
  );
  const [installCost, setInstallCost] = useState(
    formatMoneyMinor(initial.installationMinor, initial.currencyScale),
  );
  const [status, setStatus] = useState("");
  const timer = useRef<number | null>(null);
  const skipAutosave = useRef(true);
  const draftChecked = useRef(false);

  useEffect(() => {
    if (draftChecked.current) return;
    draftChecked.current = true;
    void loadDraft(initial.id).then((d) => {
      if (!d) return;
      if (d.baseRevision < initial.revision) {
        window.alert(
          "Есть локальный черновик старше серверных данных. Он не применён автоматически.",
        );
        return;
      }
      if (
        d.baseRevision === initial.revision &&
        window.confirm("Найден несохранённый черновик. Восстановить?")
      ) {
        const f = d.fields;
        if (typeof f.title === "string") setTitle(f.title);
        if (typeof f.summary === "string") setSummary(f.summary);
        if (typeof f.workDate === "string") setWorkDate(f.workDate);
        if (typeof f.dueDate === "string") setDueDate(f.dueDate);
        if (typeof f.notes === "string") setNotes(f.notes);
        if (typeof f.price === "string") setPrice(f.price);
        if (typeof f.cost === "string") setCost(f.cost);
        if (typeof f.installCost === "string") setInstallCost(f.installCost);
      }
    });
  }, [initial.id, initial.revision]);

  useEffect(() => {
    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }
    dirtyRef.current = true;
    setStatus("Есть изменения");
    emitSaveStatus("Есть изменения");
    void saveDraft({
      entityId: initial.id,
      baseRevision: revision,
      updatedAt: new Date().toISOString(),
      fields: { title, summary, workDate, dueDate, notes, price, cost, installCost },
    });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void save();
    }, 600);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, summary, workDate, dueDate, notes, price, cost, installCost]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyRef]);

  async function save() {
    setStatus("Сохраняю…");
    emitSaveStatus("Сохраняю…");
    try {
      const scale = initial.currencyScale;
      for (const [label, raw] of [
        ["Цена", price],
        ["Себестоимость", cost],
        ["Монтаж", installCost],
      ] as const) {
        const p = parseMoneyInput(raw, scale);
        if (!p.ok) throw new Error(`${label}: ${p.error}`);
      }
      const updated = await apiClient.updateInstallation(initial.id, {
        revision,
        title,
        summary,
        workDate,
        dueDate: dueDate || null,
        notes,
        priceInput: price,
        costInput: cost,
        installationCostInput: installCost,
        allowDueBeforeWork: true,
      });
      setRevision(updated.revision);
      dirtyRef.current = false;
      await clearDraft(initial.id);
      const t = new Date();
      const stamp = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
      setStatus(`Сохранено в ${stamp}`);
      emitSaveStatus(`Сохранено в ${stamp}`);
      onChanged();
    } catch (e) {
      const msg =
        typeof e === "object" && e && "message" in e
          ? String((e as { message: string }).message)
          : "Ошибка";
      setStatus(`Не сохранено — ${msg}`);
      emitSaveStatus("Не сохранено — повторить");
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Подробности</h2>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
            {status}
          </div>
        </div>
        <button type="button" className={styles.btn} onClick={onClose}>
          Закрыть
        </button>
      </div>

      <div style={{ overflow: "auto", flex: 1 }}>
        <div className={styles.field}>
          <label>Название</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label>Кратко</label>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className={styles.field}>
            <label>Рабочая дата</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label>Срок сдачи</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div className={styles.field}>
            <label>Цена</label>
            <input
              className="tabular"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label>Себестоимость</label>
            <input
              className="tabular"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label>Монтаж, стоимость работ</label>
            <input
              className="tabular"
              value={installCost}
              onChange={(e) => setInstallCost(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label>Заметки</label>
          <textarea
            rows={10}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => void save()}
        >
          Сохранить сейчас
        </button>
      </div>
    </>
  );
}
