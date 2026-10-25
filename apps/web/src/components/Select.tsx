import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { IconCheck, IconChevronDown } from "./icons";
import styles from "./ui.module.css";

export type SelectOption = { value: string; label: string };

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = "Выберите",
  className,
  "aria-label": ariaLabel,
}: {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    setActive(idx);
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, options, value]);

  function onKey(e: KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[active];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    }
  }

  const control = (
    <div
      className={[styles.selectRoot, className ?? ""].join(" ")}
      ref={rootRef}
    >
      <button
        type="button"
        className={[styles.selectTrigger, open ? styles.selectTriggerOpen : ""]
          .filter(Boolean)
          .join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel ?? label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
      >
        <span className={styles.selectValue}>
          {selected?.label ?? placeholder}
        </span>
        <IconChevronDown className={styles.selectChevron} />
      </button>
      {open && (
        <div
          id={listId}
          className={styles.selectPanel}
          role="listbox"
          aria-label={ariaLabel ?? label}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={[
                  styles.selectOption,
                  isSelected ? styles.selectOptionSelected : "",
                  i === active ? styles.selectOptionActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {isSelected ? <IconCheck className={styles.selectCheck} /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!label) return control;
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {control}
    </label>
  );
}
