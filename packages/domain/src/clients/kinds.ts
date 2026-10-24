export const CLIENT_KINDS = ["corporate", "retail"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

export function isClientKind(v: string): v is ClientKind {
  return (CLIENT_KINDS as readonly string[]).includes(v);
}

export function clientKindLabel(kind: ClientKind): string {
  return kind === "corporate" ? "Корпоративный" : "Розница";
}

/** Подпись первого поля формы */
export function displayNameFieldLabel(kind: ClientKind): string {
  return kind === "corporate" ? "Организация" : "Клиент";
}
