import type { InputHTMLAttributes } from "react";
import { IconSearch, IconX } from "./icons";
import styles from "./ui.module.css";

export function SearchField({
  value,
  onValueChange,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className={[styles.searchWrap, className ?? ""].join(" ")}>
      <IconSearch className={styles.searchIcon} />
      <input
        className={styles.searchInput}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          className={styles.searchClear}
          aria-label="Очистить поиск"
          onClick={() => onValueChange("")}
        >
          <IconX />
        </button>
      ) : null}
    </div>
  );
}
