import { useEffect, useRef, useState } from "react";
import {
  STAGE_COLORS,
  STAGE_GRID,
  STAGE_LABELS,
  computeDeadlineStatus,
  localIsoDateFromDate,
  type StageCode,
} from "@workbook/domain";
import { apiClient, type InstallationDto } from "../../api/client";
import { emitSaveStatus } from "../../app/App";
import { Switch } from "../../components";
import ui from "../../components/ui.module.css";
import { publishMutation } from "../../lib/sync";
import styles from "../../styles/app.module.css";

export function InstallationCard({
  installation,
  onOpen,
  onChanged,
  showClient,
}: {
  installation: InstallationDto;
  onOpen: () => void;
  onChanged: () => void;
  showClient?: boolean;
}) {
  const [busyStage, setBusyStage] = useState<StageCode | null>(null);
  const [title, setTitle] = useState(installation.title);
  const [notes, setNotes] = useState(installation.notes ?? "");
  const [extra, setExtra] = useState(installation.summary ?? "");
  const notesTimer = useRef<number | null>(null);
  const extraTimer = useRef<number | null>(null);
  const titleSaveTimer = useRef<number | null>(null);
  const revisionRef = useRef(installation.revision);
  const dirtyTitle = useRef(false);
  const dirtyNotes = useRef(false);
  const dirtyExtra = useRef(false);
  const saveChain = useRef(Promise.resolve());

  useEffect(() => {
    if (!dirtyTitle.current) setTitle(installation.title);
    if (!dirtyNotes.current) setNotes(installation.notes ?? "");
    if (!dirtyExtra.current) setExtra(installation.summary ?? "");
    revisionRef.current = installation.revision;
  }, [
    installation.id,
    installation.title,
    installation.notes,
    installation.summary,
    installation.revision,
  ]);

  useEffect(() => {
    return () => {
      if (notesTimer.current) window.clearTimeout(notesTimer.current);
      if (extraTimer.current) window.clearTimeout(extraTimer.current);
      if (titleSaveTimer.current) window.clearTimeout(titleSaveTimer.current);
    };
  }, []);

  const deadline = computeDeadlineStatus({
    dueDate: installation.dueDate,
    completed: installation.completed,
    todayIso: localIsoDateFromDate(new Date()),
  });

  async function toggleStage(stage: StageCode, enabled: boolean) {
    if (busyStage) return;
    setBusyStage(stage);
    emitSaveStatus("Сохраняю…");
    try {
      const row = await apiClient.setStage(installation.id, {
        revision: revisionRef.current,
        stage,
        enabled,
      });
      revisionRef.current = row.revision;
      emitSaveStatus("Сохранено");
      publishMutation(["month", "installations"]);
      onChanged();
    } catch (e) {
      emitSaveStatus("Не сохранено — повторить");
      console.error(e);
    } finally {
      setBusyStage(null);
    }
  }

  async function toggleCompleted(completed: boolean) {
    emitSaveStatus("Сохраняю…");
    try {
      const row = await apiClient.setCompleted(installation.id, {
        revision: revisionRef.current,
        completed,
      });
      revisionRef.current = row.revision;
      emitSaveStatus("Сохранено");
      publishMutation(["month", "installations"]);
      if (
        completed &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        burstConfetti();
      }
      onChanged();
    } catch {
      emitSaveStatus("Не сохранено — повторить");
    }
  }

  function persist(patch: {
    title?: string;
    notes?: string | null;
    summary?: string | null;
  }) {
    saveChain.current = saveChain.current.then(async () => {
      emitSaveStatus("Сохраняю…");
      try {
        const row = await apiClient.updateInstallation(installation.id, {
          revision: revisionRef.current,
          ...patch,
        });
        revisionRef.current = row.revision;
        if (patch.title !== undefined) dirtyTitle.current = false;
        if (patch.notes !== undefined) dirtyNotes.current = false;
        if (patch.summary !== undefined) dirtyExtra.current = false;
        emitSaveStatus("Сохранено");
        publishMutation(["month", "installations"]);
        onChanged();
      } catch {
        emitSaveStatus("Не сохранено — повторить");
      }
    });
  }

  function scheduleNotesSave(next: string) {
    dirtyNotes.current = true;
    setNotes(next);
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => {
      const trimmed = next.trim() === "" ? null : next;
      const baseline = (installation.notes ?? "").trim() || null;
      if (trimmed === baseline) {
        dirtyNotes.current = false;
        return;
      }
      persist({ notes: trimmed });
    }, 400);
  }

  function scheduleExtraSave(next: string) {
    dirtyExtra.current = true;
    setExtra(next);
    if (extraTimer.current) window.clearTimeout(extraTimer.current);
    extraTimer.current = window.setTimeout(() => {
      const trimmed = next.trim() === "" ? null : next;
      const baseline = (installation.summary ?? "").trim() || null;
      if (trimmed === baseline) {
        dirtyExtra.current = false;
        return;
      }
      persist({ summary: trimmed });
    }, 400);
  }

  function scheduleTitleSave(next: string) {
    dirtyTitle.current = true;
    setTitle(next);
    if (titleSaveTimer.current) window.clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = window.setTimeout(() => {
      const t = next.trim();
      if (!t || t === installation.title) {
        if (!t) setTitle(installation.title);
        dirtyTitle.current = false;
        return;
      }
      persist({ title: t });
    }, 400);
  }

  return (
    <article
      className={`${styles.card} ${installation.completed ? styles.cardDone : ""}`}
      onClick={(e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (
          t.closest("button, input, textarea, a, label, [role='switch']")
        ) {
          return;
        }
        onOpen();
      }}
    >
      <div className={`${styles.cardBlock} ${styles.cardMeta}`}>
        <div className="tabular" style={{ fontWeight: 600 }}>
          {installation.workDate}
        </div>
        <div
          style={{
            fontWeight: 600,
            color:
              deadline.tone === "ok"
                ? "var(--deadline-ok)"
                : deadline.tone === "yellow"
                  ? "var(--deadline-yellow)"
                  : deadline.tone === "orange"
                    ? "var(--deadline-orange)"
                    : deadline.tone === "danger"
                      ? "var(--deadline-danger)"
                      : deadline.tone === "overdue"
                        ? "var(--deadline-overdue)"
                        : deadline.tone === "done"
                          ? "var(--deadline-ok)"
                          : "var(--deadline-muted)",
          }}
        >
          {deadline.label}
          {installation.dueDate ? (
            <span className="tabular"> · {installation.dueDate}</span>
          ) : null}
        </div>
      </div>

      <div className={`${styles.cardBlock} ${styles.cardStages}`}>
        <div className={styles.stages} role="group" aria-label="Этапы">
          {STAGE_GRID.flat().map((code) => {
            const on = installation.stages[code];
            return (
              <button
                key={code}
                type="button"
                className={`${styles.stageBtn} ${on ? styles.stageOn : ""}`}
                style={
                  on
                    ? {
                        background: STAGE_COLORS[code],
                        color: "#fff",
                        borderColor: "transparent",
                      }
                    : undefined
                }
                aria-pressed={on}
                aria-label={`${STAGE_LABELS[code]}: ${on ? "выполнен" : "не выполнен"}`}
                disabled={busyStage === code}
                onClick={() => toggleStage(code, !on)}
              >
                {STAGE_LABELS[code]}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${styles.cardBlock} ${styles.cardMain}`}>
        {showClient && (
          <div className={styles.cardClientLine}>
            {installation.clientKind === "corporate"
              ? "Корпоративный"
              : "Розница"}{" "}
            · {installation.clientDisplayName}
          </div>
        )}
        <input
          className={styles.cardTitleInput}
          value={title}
          aria-label="Название задачи"
          onChange={(e) => scheduleTitleSave(e.target.value)}
          onBlur={() => {
            const t = title.trim();
            if (!t) {
              setTitle(installation.title);
              dirtyTitle.current = false;
            }
          }}
        />
        <input
          type="text"
          className={styles.cardBodyInput}
          value={notes.replace(/\s+/g, " ")}
          aria-label="Заметки"
          placeholder="Заметки…"
          onChange={(e) => scheduleNotesSave(e.target.value)}
        />
        {showClient ? (
          <input
            type="text"
            className={styles.cardBodyInput}
            value={extra.replace(/\s+/g, " ")}
            aria-label="Доп инфа"
            placeholder="Доп инфа…"
            onChange={(e) => scheduleExtraSave(e.target.value)}
          />
        ) : null}
      </div>

      <div className={`${styles.cardBlock} ${styles.cardDoneCol}`}>
        <div className={ui.switchStack}>
          <Switch
            checked={installation.completed}
            onCheckedChange={(v) => void toggleCompleted(v)}
            aria-label="Выполнен"
          />
          <span className={ui.switchLabel}>Выполнен</span>
        </div>
      </div>
    </article>
  );
}

function burstConfetti() {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:100;overflow:hidden";
  for (let i = 0; i < 24; i++) {
    const d = document.createElement("div");
    const x = 40 + Math.random() * 20;
    d.style.cssText = `position:absolute;left:${x}%;top:45%;width:8px;height:8px;border-radius:2px;background:hsl(${120 + Math.random() * 40},40%,45%);opacity:.85;transform:translateY(0);animation:wb-confetti 700ms ease-out forwards;animation-delay:${Math.random() * 120}ms`;
    root.appendChild(d);
  }
  const style = document.createElement("style");
  style.textContent = `@keyframes wb-confetti{to{transform:translate(${-40 + Math.random() * 80}px,120px) rotate(180deg);opacity:0}}`;
  root.appendChild(style);
  document.body.appendChild(root);
  window.setTimeout(() => root.remove(), 900);
}
