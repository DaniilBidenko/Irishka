import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { Button } from "../../components";
import { publishMutation } from "../../lib/sync";

export function TrashPanel() {
  const qc = useQueryClient();
  const trash = useQuery({
    queryKey: ["trash"],
    queryFn: () => apiClient.listTrash(),
  });

  async function restoreInstallation(id: string) {
    await apiClient.restoreInstallation(id);
    publishMutation(["trash", "clients", "month", "installations"]);
    await qc.invalidateQueries();
  }

  async function restoreBatch(batchId: string) {
    await apiClient.restoreBatch(batchId);
    publishMutation(["trash", "clients", "month", "installations"]);
    await qc.invalidateQueries();
  }

  if (trash.isLoading) return <p>Загрузка корзины…</p>;
  if (trash.isError) return <p>Не удалось загрузить корзину</p>;

  const clients = trash.data?.clients ?? [];
  const installations = trash.data?.installations ?? [];

  if (clients.length === 0 && installations.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontSize: "var(--fs-sm)" }}>
        Корзина пуста. Записи не удаляются физически в первой версии.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {clients.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Клиенты</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {clients.map((c) => (
              <li
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{c.displayName}</strong>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
                    {c.kind === "corporate" ? "Корпоративный" : "Розница"}
                    {c.deletionBatchId
                      ? ` · партия ${c.deletionBatchId.slice(0, 8)}…`
                      : ""}
                  </div>
                </div>
                {c.deletionBatchId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void restoreBatch(c.deletionBatchId!)}
                  >
                    Восстановить группу
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {installations.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Монтажи</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {installations.map((i) => (
              <li
                key={i.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{i.title}</strong>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
                    {i.clientDisplayName} · {i.workDate}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void restoreInstallation(i.id)}
                >
                  Восстановить
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
