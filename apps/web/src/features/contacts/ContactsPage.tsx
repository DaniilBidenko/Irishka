import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { clientKindLabel, type ClientKind } from "@workbook/domain";
import { apiClient, type ClientDto } from "../../api/client";
import { Button, SearchField, Select } from "../../components";
import styles from "../../styles/app.module.css";

type KindFilter = "all" | ClientKind;

function contactTitle(c: ClientDto): string {
  if (c.contactName?.trim()) return c.contactName.trim();
  return c.displayName;
}

function organizationLabel(c: ClientDto): string {
  if (c.kind === "corporate") return c.displayName;
  return c.contactName?.trim() && c.contactName.trim() !== c.displayName
    ? c.displayName
    : "Розничный клиент";
}

export function ContactsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");

  const corporate = useQuery({
    queryKey: ["clients", "corporate"],
    queryFn: () => apiClient.listClients("corporate"),
  });
  const retail = useQuery({
    queryKey: ["clients", "retail"],
    queryFn: () => apiClient.listClients("retail"),
  });

  const loading = corporate.isLoading || retail.isLoading;
  const error = corporate.isError || retail.isError;

  const items = useMemo(() => {
    const all: ClientDto[] = [
      ...(corporate.data?.items ?? []),
      ...(retail.data?.items ?? []),
    ];
    const needle = q.trim().toLowerCase();
    return all
      .filter((c) => (kind === "all" ? true : c.kind === kind))
      .filter((c) => {
        if (!needle) return true;
        return (
          c.displayName.toLowerCase().includes(needle) ||
          (c.contactName ?? "").toLowerCase().includes(needle) ||
          (c.phone ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) =>
        contactTitle(a).localeCompare(contactTitle(b), "ru", {
          sensitivity: "base",
        }),
      );
  }, [corporate.data, retail.data, kind, q]);

  return (
    <div className={styles.body}>
      <main className={styles.main} style={{ width: "100%" }}>
        <div className={styles.sectionHead} style={{ paddingLeft: 0 }}>
          <h1 className={styles.sectionTitle}>Контакты</h1>
          <span className={styles.sectionMeta}>{items.length}</span>
        </div>

        <div className={styles.filtersRow}>
          <div
            className={styles.filterItem}
            style={{ maxWidth: 280, flex: "1 1 220px" }}
          >
            <SearchField
              placeholder="Поиск по имени, организации, телефону"
              value={q}
              onValueChange={setQ}
              aria-label="Поиск контактов"
            />
          </div>
          <div className={styles.filterItem} style={{ maxWidth: 200 }}>
            <Select
              aria-label="Тип"
              value={kind}
              onChange={(v) => setKind(v as KindFilter)}
              options={[
                { value: "all", label: "Все" },
                { value: "corporate", label: "Корпоративные" },
                { value: "retail", label: "Розница" },
              ]}
            />
          </div>
        </div>

        {loading && <div className={styles.empty}>Загрузка…</div>}
        {error && (
          <div className={styles.empty}>Не удалось загрузить контакты</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className={styles.empty}>
            <p>Контактов пока нет</p>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
              Добавьте клиента в «Корпоративные» или «Розница» — он появится
              здесь.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Button
                variant="secondary"
                onClick={() => navigate("/corporate")}
              >
                К корпоративным
              </Button>
              <Button variant="secondary" onClick={() => navigate("/retail")}>
                К рознице
              </Button>
            </div>
          </div>
        )}

        <div className={styles.contactGrid}>
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.contactCard}
              onClick={() => navigate(`/${c.kind}/${c.id}`)}
            >
              <div className={styles.contactCardTop}>
                <span
                  className={
                    c.kind === "corporate"
                      ? styles.contactKindCorp
                      : styles.contactKindRetail
                  }
                >
                  {clientKindLabel(c.kind)}
                </span>
              </div>
              <div className={styles.contactName}>{contactTitle(c)}</div>
              <div className={styles.contactOrg}>{organizationLabel(c)}</div>
              <div className={styles.contactPhone}>
                {c.phone?.trim() || "Телефон не указан"}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
