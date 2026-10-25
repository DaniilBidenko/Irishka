import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  formatMoneyMinor,
  type CostCategory,
} from "@workbook/domain";
import { apiClient, type CostServiceDto } from "../../api/client";
import { emitSaveStatus } from "../../app/App";
import { Button } from "../../components";
import { publishMutation } from "../../lib/sync";
import styles from "../../styles/app.module.css";

export function CostCatalogPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cost-services"],
    queryFn: () => apiClient.listCostServices(),
  });

  const byCategory = useMemo(() => {
    const map: Record<CostCategory, CostServiceDto[]> = {
      polygraphy: [],
      souvenirs: [],
      outdoor: [],
    };
    for (const item of q.data?.items ?? []) {
      map[item.category].push(item);
    }
    return map;
  }, [q.data]);

  return (
    <div className={styles.body}>
      <main className={styles.main} style={{ width: "100%" }}>
        <div className={styles.sectionHead} style={{ paddingLeft: 0 }}>
          <h1 className={styles.sectionTitle}>Себестоимость</h1>
          <span className={styles.sectionMeta}>
            {(q.data?.items ?? []).length}
          </span>
        </div>

        {q.isLoading && <div className={styles.empty}>Загрузка…</div>}
        {q.isError && (
          <div className={styles.empty}>
            <p>Не удалось загрузить справочник</p>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--muted)" }}>
              {(q.error as { message?: string })?.message ??
                "Проверьте, что применена миграция схемы и сервер перезапущен."}
            </p>
          </div>
        )}

        {!q.isLoading && !q.isError && (
          <div className={styles.costColumns}>
            {COST_CATEGORIES.map((category) => (
              <CategoryColumn
                key={category}
                category={category}
                items={byCategory[category]}
                onChanged={() => {
                  void qc.invalidateQueries({ queryKey: ["cost-services"] });
                  publishMutation(["cost-services"]);
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CategoryColumn({
  category,
  items,
  onChanged,
}: {
  category: CostCategory;
  items: CostServiceDto[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section
      className={styles.costColumn}
      aria-label={COST_CATEGORY_LABELS[category]}
    >
      <header className={styles.costColumnHead}>
        <h2 className={styles.costColumnTitle}>
          {COST_CATEGORY_LABELS[category]}
        </h2>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setAdding(true)}
        >
          Услуга
        </Button>
      </header>

      <div className={styles.costGridHead} aria-hidden>
        <span>Название</span>
        <span>Себес</span>
        <span>Итог</span>
      </div>

      <div className={styles.costServiceList}>
        {items.length === 0 && !adding ? (
          <div className={styles.costEmpty}>Пока нет услуг</div>
        ) : null}
        {items.map((item) => (
          <ServiceEditor key={item.id} item={item} onChanged={onChanged} />
        ))}
        {adding ? (
          <ServiceEditor
            category={category}
            onChanged={() => {
              setAdding(false);
              onChanged();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : null}
      </div>
    </section>
  );
}

function ServiceEditor({
  item,
  category,
  onChanged,
  onCancel,
}: {
  item?: CostServiceDto;
  category?: CostCategory;
  onChanged: () => void;
  onCancel?: () => void;
}) {
  const isNew = !item;
  const saved = item
    ? formatMoneyMinor(item.priceMinor, item.currencyScale)
    : "";
  const [name, setName] = useState(item?.name ?? "");
  const [cost, setCost] = useState(saved);
  const [total, setTotal] = useState(saved);
  const [autoTotal, setAutoTotal] = useState(!item);
  const [status, setStatus] = useState("");
  const [dirty, setDirty] = useState(isNew);

  useEffect(() => {
    if (!item) return;
    const t = formatMoneyMinor(item.priceMinor, item.currencyScale);
    setName(item.name);
    setCost(t);
    setTotal(t);
    setAutoTotal(false);
    setDirty(false);
    setStatus("");
  }, [item?.id, item?.name, item?.priceMinor, item?.currencyScale, item?.revision]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const priceInput = total.trim() || cost.trim() || "0";
      if (isNew) {
        if (!category) throw new Error("Нет категории");
        return apiClient.createCostService({
          category,
          name: name.trim(),
          priceInput,
        });
      }
      return apiClient.updateCostService(item.id, {
        revision: item.revision,
        name: name.trim(),
        priceInput,
      });
    },
    onSuccess: () => {
      setDirty(false);
      setStatus("");
      emitSaveStatus("Сохранено");
      onChanged();
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Не сохранено";
      setStatus(msg);
      emitSaveStatus("Не сохранено — повторить");
    },
  });

  async function remove() {
    if (!item) return;
    if (!window.confirm(`Удалить услугу «${item.name}»?`)) return;
    emitSaveStatus("Сохраняю…");
    try {
      await apiClient.trashCostService(item.id, item.revision);
      emitSaveStatus("Сохранено");
      onChanged();
    } catch {
      emitSaveStatus("Не сохранено — повторить");
    }
  }

  return (
    <div className={styles.costServiceRow}>
      <div className={styles.costCell}>
        <input
          className={styles.costCellInput}
          placeholder="Название"
          value={name}
          aria-label="Название"
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
        />
      </div>
      <div className={styles.costCell}>
        <input
          className={`${styles.costCellInput} tabular`}
          inputMode="decimal"
          placeholder="0"
          value={cost}
          aria-label="Себес"
          onChange={(e) => {
            const next = e.target.value;
            setCost(next);
            setDirty(true);
            if (autoTotal) setTotal(next);
          }}
        />
      </div>
      <div className={styles.costCell}>
        <input
          className={`${styles.costCellInput} ${styles.costTotalInput} tabular`}
          inputMode="decimal"
          placeholder="Итог"
          value={total}
          aria-label="Итог"
          onChange={(e) => {
            setAutoTotal(false);
            setTotal(e.target.value);
            setDirty(true);
          }}
        />
      </div>
      <div className={styles.costRowActionsWide}>
        {status ? <div className={styles.costFormError}>{status}</div> : null}
        {dirty ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={saveMutation.isPending || !name.trim()}
            onClick={() => saveMutation.mutate()}
          >
            Сохранить
          </Button>
        ) : null}
        {isNew && onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Отмена
          </Button>
        ) : null}
        {!isNew ? (
          <Button type="button" variant="danger" size="sm" onClick={() => void remove()}>
            Удалить
          </Button>
        ) : null}
      </div>
    </div>
  );
}
