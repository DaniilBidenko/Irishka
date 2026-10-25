import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

type Variant = "secondary" | "primary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "md" | "sm";
  children: ReactNode;
}) {
  const variantClass =
    variant === "primary"
      ? styles.btnPrimary
      : variant === "ghost"
        ? styles.btnGhost
        : variant === "danger"
          ? styles.btnDanger
          : "";
  return (
    <button
      type="button"
      className={[
        styles.btn,
        variantClass,
        size === "sm" ? styles.btnSm : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  ghost,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  ghost?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={[
        styles.iconBtn,
        ghost ? styles.iconBtnGhost : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
