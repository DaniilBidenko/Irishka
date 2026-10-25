import type { ButtonHTMLAttributes } from "react";
import styles from "./ui.module.css";

export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={[
        styles.switch,
        checked ? styles.switchOn : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onCheckedChange(!checked)}
      {...rest}
    >
      <span className={styles.switchThumb} />
    </button>
  );

  if (!label) return control;

  return (
    <label className={styles.switchRow}>
      {control}
      <span className={styles.switchLabel}>{label}</span>
    </label>
  );
}
