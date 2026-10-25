import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "./icons";
import { IconButton } from "./Button";
import styles from "./ui.module.css";

export function YearPicker({
  year,
  onChange,
}: {
  year: number;
  onChange: (year: number) => void;
}) {
  const [draft, setDraft] = useState(String(year));

  useEffect(() => {
    setDraft(String(year));
  }, [year]);

  function commit(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    const y = Number(digits);
    if (digits.length === 4 && y >= 1990 && y <= 2100) {
      onChange(y);
      setDraft(String(y));
    } else {
      setDraft(String(year));
    }
  }

  return (
    <div className={styles.yearPicker} role="group" aria-label="Год">
      <IconButton
        label="Предыдущий год"
        ghost
        onClick={() => onChange(year - 1)}
        style={{ width: 34, height: 34, minWidth: 34 }}
      >
        <IconChevronLeft />
      </IconButton>
      <input
        className={styles.yearValue}
        inputMode="numeric"
        value={draft}
        aria-label="Год"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          setDraft(digits);
          if (digits.length === 4) {
            const y = Number(digits);
            if (y >= 1990 && y <= 2100) onChange(y);
          }
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(year + 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(year - 1);
          }
        }}
      />
      <IconButton
        label="Следующий год"
        ghost
        onClick={() => onChange(year + 1)}
        style={{ width: 34, height: 34, minWidth: 34 }}
      >
        <IconChevronRight />
      </IconButton>
    </div>
  );
}
