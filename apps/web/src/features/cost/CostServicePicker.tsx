import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  formatMoneyMinor,
  type CostCategory,
} from "@workbook/domain";
import { apiClient, type CostServiceDto } from "../../api/client";
import { Button, IconButton, IconPin, IconX, SearchField } from "../../components";
import styles from "../../styles/app.module.css";

export function CostServicePicker({
  open,
  pinned,
  onPinnedChange,
  onClose,
  onPick,
}: {
  open: boolean;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  onClose: () => void;
  onPick: (service: CostServiceDto) => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CostCategory | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const listQ = useQuery({
    queryKey: ["cost-services"],
    queryFn: () => apiClient.listCostServices(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setQ("");
      setCategory(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || pinned) return;
    function onDoc(e: MouseEvent) {
      const el = panelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        onClose();
      }
    }
    // capture после текущего клика открытия
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, pinned, onClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let items = listQ.data?.items ?? [];
    if (category) items = items.filter((s) => s.category === category);
    if (!needle) return items;
    return items.filter((s) => s.name.toLowerCase().includes(needle));
  }, [listQ.data, category, q]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={styles.costPicker}
      role="dialog"
      aria-label="Справочник себестоимости"
    >
      <div className={styles.costPickerHead}>
        <strong>Услуги</strong>
        <div className={styles.costPickerHeadActions}>
          <IconButton
            label={pinned ? "Открепить панель" : "Закрепить панель"}
            ghost
            aria-pressed={pinned}
            onClick={() => onPinnedChange(!pinned)}
            className={pinned ? styles.costPickerPinOn : undefined}
          >
            <IconPin />
          </IconButton>
          <IconButton label="Закрыть справочник" ghost onClick={onClose}>
            <IconX />
          </IconButton>
        </div>
      </div>

      <SearchField
        placeholder="Поиск услуги"
        value={q}
        onValueChange={setQ}
        aria-label="Поиск услуги"
      />

      {!category ? (
        <div className={styles.costPickerCats}>
          {COST_CATEGORIES.map((c) => {
            const count = (listQ.data?.items ?? []).filter(
              (s) => s.category === c,
            ).length;
            return (
              <button
                key={c}
                type="button"
                className={styles.costPickerCat}
                onClick={() => setCategory(c)}
              >
                <span>{COST_CATEGORY_LABELS[c]}</span>
                <span className={styles.sectionMeta}>{count}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className={styles.costPickerBack}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCategory(null)}
            >
              ← {COST_CATEGORY_LABELS[category]}
            </Button>
          </div>
          {listQ.isLoading && (
            <div className={styles.costEmpty}>Загрузка…</div>
          )}
          {listQ.isError && (
            <div className={styles.costEmpty}>Не удалось загрузить</div>
          )}
          {!listQ.isLoading && !listQ.isError && filtered.length === 0 && (
            <div className={styles.costEmpty}>Нет услуг</div>
          )}
          <ul className={styles.costPickerList}>
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={styles.costPickerItem}
                  onClick={() => onPick(s)}
                >
                  <span className={styles.costServiceName}>{s.name}</span>
                  <span className={`${styles.costServicePrice} tabular`}>
                    {formatMoneyMinor(s.priceMinor, s.currencyScale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {pinned ? (
        <div className={styles.costPickerPinHint}>
          Закреплено — закроется кнопкой или при закрытии подробностей
        </div>
      ) : null}
    </div>
  );
}
