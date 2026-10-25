import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, type InstallationDto } from "../../api/client";
import { emitSaveStatus } from "../../app/App";
import { Button, TextArea, TextField } from "../../components";
import ui from "../../components/ui.module.css";
import { clearDraft, loadDraft, saveDraft } from "../../lib/drafts";
import { publishMutation } from "../../lib/sync";
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
          <Button variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
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
  const [customValues, setCustomValues] = useState<
    Record<string, string | number | null>
  >(initial.customValues ?? {});
  const [status, setStatus] = useState("");
  const timer = useRef<number | null>(null);
  const skipAutosave = useRef(true);
  const draftChecked = useRef(false);

  const fieldsQ = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => apiClient.listCustomFields(),
  });

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
      fields: { title, summary, workDate, dueDate, notes },
    });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void save();
    }, 600);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, summary, workDate, dueDate, notes, customValues]);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dirtyRef.current) {
        const leave = window.confirm(
          "Есть несохранённые изменения. Закрыть?",
        );
        if (!leave) return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dirtyRef]);

  async function save() {
    setStatus("Сохраняю…");
    emitSaveStatus("Сохраняю…");
    try {
      const updated = await apiClient.updateInstallation(initial.id, {
        revision,
        title,
        summary,
        workDate,
        dueDate: dueDate || null,
        notes,
        customValues,
        allowDueBeforeWork: true,
      });
      setRevision(updated.revision);
      dirtyRef.current = false;
      await clearDraft(initial.id);
      publishMutation(["installation", "month", "installations"]);
      const t = new Date();
      const stamp = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
      setStatus(`Сохранено в ${stamp}`);
      emitSaveStatus(`Сохранено в ${stamp}`);
      onChanged();
    } catch (e) {
      const err = e as {
        code?: string;
        message?: string;
        details?: { server?: InstallationDto };
      };
      if (err.code === "CONFLICT") {
        const takeServer = window.confirm(
          "Конфликт версий: запись изменена в другом месте.\nOK — взять серверную версию, Отмена — оставить ваши правки в форме.",
        );
        if (takeServer && err.details?.server) {
          const s = err.details.server;
          setRevision(s.revision);
          setTitle(s.title);
          setSummary(s.summary ?? "");
          setWorkDate(s.workDate);
          setDueDate(s.dueDate ?? "");
          setNotes(s.notes ?? "");
          setCustomValues(s.customValues ?? {});
          dirtyRef.current = false;
          setStatus("Загружена серверная версия");
        } else {
          setStatus("Конфликт — правки не сохранены");
        }
        emitSaveStatus("Не сохранено — конфликт версий");
        return;
      }
      const msg = err.message ?? "Ошибка";
      setStatus(`Не сохранено — ${msg}`);
      emitSaveStatus("Не сохранено — повторить");
    }
  }

  return (
    <div className={styles.detailEditor}>
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
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </div>

      <div style={{ overflow: "auto", flex: 1, paddingRight: 4 }}>
        <TextField
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Доп инфа"
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <TextField
            label="Рабочая дата"
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
          />
          <TextField
            label="Срок сдачи"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <TextArea
          label="Заметки"
          rows={8}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {(fieldsQ.data?.items ?? [])
          .filter((f) => !f.archivedAt)
          .map((f) =>
            f.type === "multiline" ? (
              <TextArea
                key={f.id}
                label={f.label}
                rows={3}
                value={String(customValues[f.id] ?? "")}
                onChange={(e) =>
                  setCustomValues((prev) => ({
                    ...prev,
                    [f.id]: e.target.value,
                  }))
                }
              />
            ) : (
              <TextField
                key={f.id}
                label={f.label}
                type={
                  f.type === "number"
                    ? "number"
                    : f.type === "date"
                      ? "date"
                      : "text"
                }
                value={String(customValues[f.id] ?? "")}
                onChange={(e) =>
                  setCustomValues((prev) => ({
                    ...prev,
                    [f.id]:
                      f.type === "number"
                        ? e.target.value === ""
                          ? null
                          : Number(e.target.value)
                        : e.target.value,
                  }))
                }
              />
            ),
          )}
      </div>

      <div
        className={ui.btnRow}
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <Button variant="primary" onClick={() => void save()}>
          Сохранить сейчас
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (!window.confirm("Переместить монтаж в корзину?")) return;
            void apiClient.trashInstallation(initial.id, revision).then(() => {
              publishMutation(["trash", "month", "installations"]);
              onChanged();
              onClose();
            });
          }}
        >
          В корзину
        </Button>
      </div>
    </div>
  );
}
