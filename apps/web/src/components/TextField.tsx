import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

export function FormField({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={[styles.field, className ?? ""].join(" ")}>
      {label ? <span className={styles.fieldLabel}>{label}</span> : null}
      {children}
    </label>
  );
}

export function TextField({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const input = (
    <input className={[styles.control, className ?? ""].join(" ")} {...rest} />
  );
  if (!label) return input;
  return <FormField label={label}>{input}</FormField>;
}

export function TextArea({
  label,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const area = (
    <textarea
      className={[styles.textarea, className ?? ""].join(" ")}
      {...rest}
    />
  );
  if (!label) return area;
  return <FormField label={label}>{area}</FormField>;
}
