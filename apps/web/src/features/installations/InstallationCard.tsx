import { useRef, useState } from "react";
import {
  STAGE_COLORS,
  STAGE_GRID,
  STAGE_LABELS,
  computeDeadlineStatus,
  formatMoneyMinor,
  localIsoDateFromDate,
  type StageCode,
} from "@workbook/domain";
import { apiClient, type InstallationDto } from "../../api/client";
import { emitSaveStatus } from "../../app/App";
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
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(
    null,
  );
  const hoverTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);

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
      await apiClient.setStage(installation.id, {
        revision: installation.revision,
        stage,
        enabled,
      });
      emitSaveStatus("Сохранено");
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
      await apiClient.setCompleted(installation.id, {
        revision: installation.revision,
        completed,
      });
      emitSaveStatus("Сохранено");
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

  function onEnter(e: React.MouseEvent) {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    const { clientX, clientY } = e;
    hoverTimer.current = window.setTimeout(() => {
      setPreview({ x: clientX + 12, y: clientY + 12 });
    }, 450);
  }

  function onLeave() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    leaveTimer.current = window.setTimeout(() => setPreview(null), 200);
  }

  return (
    <>
      <article
        className={`${styles.card} ${installation.completed ? styles.cardDone : ""}`}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div className={styles.cardBlock}>
          <div className="tabular" style={{ fontWeight: 600 }}>
            {installation.workDate}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: "var(--fs-sm)",
              color:
                deadline.tone === "ok"
                  ? "var(--deadline-ok)"
                  : deadline.tone === "warn"
                    ? "var(--deadline-warn)"
                    : deadline.tone === "danger"
                      ? "var(--deadline-danger)"
                      : deadline.tone === "dangerStrong"
                        ? "var(--deadline-strong)"
                        : deadline.tone === "done"
                          ? "var(--deadline-ok)"
                          : "var(--deadline-muted)",
            }}
          >
            {deadline.label}
            {installation.dueDate ? (
              <div className="tabular">{installation.dueDate}</div>
            ) : null}
          </div>
          {installation.priceMinor !== null && (
            <div className="tabular" style={{ marginTop: 8, fontSize: "var(--fs-sm)" }}>
              {formatMoneyMinor(
                installation.priceMinor,
                installation.currencyScale,
              )}{" "}
              {installation.currencyCode}
            </div>
          )}
        </div>

        <div className={styles.cardBlock}>
          <div className={styles.stages} role="group" aria-label="Этапы">
            {STAGE_GRID.flat().map((code) => {
              const on = installation.stages[code];
              return (
                <button
                  key={code}
                  type="button"
                  className={`${styles.stageBtn} ${on ? styles.stageOn : ""}`}
                  style={on ? { background: STAGE_COLORS[code] } : undefined}
                  aria-pressed={on}
                  aria-label={STAGE_LABELS[code]}
                  disabled={busyStage === code}
                  onClick={() => toggleStage(code, !on)}
                >
                  {STAGE_LABELS[code]}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.cardBlock}>
          {showClient && (
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
              {installation.clientKind === "corporate"
                ? "Корпоративный"
                : "Розница"}{" "}
              · {installation.clientDisplayName}
            </div>
          )}
          <button type="button" className={styles.titleBtn} onClick={onOpen}>
            {installation.title}
          </button>
          {installation.summary && (
            <p className={styles.summary}>{installation.summary}</p>
          )}
          <button
            type="button"
            className={styles.btn}
            style={{ marginTop: 8 }}
            onClick={onOpen}
          >
            Предпросмотр
          </button>
        </div>

        <div
          className={styles.cardBlock}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <label style={{ fontSize: 12, textAlign: "center" }}>
            <input
              type="checkbox"
              checked={installation.completed}
              onChange={(e) => toggleCompleted(e.target.checked)}
            />
            <span style={{ display: "block" }}>Выполнен</span>
          </label>
        </div>
      </article>

      {preview && (
        <div
          className={styles.preview}
          style={{ left: preview.x, top: preview.y }}
          onMouseEnter={() => {
            if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
          }}
          onMouseLeave={onLeave}
          role="dialog"
          aria-label="Предпросмотр"
        >
          <strong>{installation.title}</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {installation.notes || installation.summary || "Нет заметок"}
          </p>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
            Только чтение · клик по названию откроет редактор
          </p>
        </div>
      )}
    </>
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
