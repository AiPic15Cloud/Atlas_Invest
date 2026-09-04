import { useMemo, useState } from "react";
import { BudgetItemForm } from "./BudgetItemForm";
import { BudgetItemCard } from "./BudgetItemCard";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import type { BudgetCategory, BudgetItemNode } from "../api/types";

const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

const CATEGORY_TITLE_COLOR: Record<BudgetCategory, string> = {
  BESOINS: "text-amber-600",
  ENVIES: "text-pink-600",
  EPARGNE: "text-violet-600",
};

const CATEGORY_BAR_COLOR: Record<BudgetCategory, string> = {
  BESOINS: "bg-amber-500",
  ENVIES: "bg-pink-500",
  EPARGNE: "bg-violet-500",
};

interface BudgetCategorySectionProps {
  category: BudgetCategory;
  title: string;
  items: BudgetItemNode[];
  target: number;
  actual: number;
  showTarget: boolean;
  search?: string;
  onAddItem: (category: BudgetCategory, data: { name: string; monthlyAmount: number; essential: boolean }) => Promise<void>;
  onAddChild: (parentId: string, data: { name: string; monthlyAmount: number; essential: boolean }) => Promise<void>;
  onUpdate: (id: string, data: { name: string; monthlyAmount: number; essential: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => Promise<void>;
}

export function BudgetCategorySection({
  category,
  title,
  items,
  target,
  actual,
  showTarget,
  search,
  onAddItem,
  onAddChild,
  onUpdate,
  onDelete,
  onMove,
}: BudgetCategorySectionProps) {
  const currency = useCurrencyFormatter();
  const [adding, setAdding] = useState(false);
  const overBudget = showTarget && actual > target;
  const categoryTotal = showTarget ? target : actual;

  const visibleItems = useMemo(() => {
    const q = search?.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q) || item.children.some((c) => c.name.toLowerCase().includes(q)));
  }, [items, search]);

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`font-semibold ${CATEGORY_TITLE_COLOR[category]}`}>{title}</h2>
          <p className={`text-xs ${overBudget ? "text-red-600" : "text-slate-500"}`}>
            {currency.format(actual)}
            {showTarget && (
              <>
                {" "}
                / cible {currency.format(target)} ({percent.format(target > 0 ? actual / target : 0)})
                {overBudget && " — dépassement"}
              </>
            )}
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-sm link">
            + Ajouter un poste
          </button>
        )}
      </div>

      {adding && (
        <BudgetItemForm
          submitLabel="Ajouter"
          onCancel={() => setAdding(false)}
          onSubmit={async (data) => {
            await onAddItem(category, data);
            setAdding(false);
          }}
        />
      )}

      {items.length === 0 && !adding ? (
        <p className="mt-2 text-sm text-slate-500">Aucun poste pour l'instant.</p>
      ) : visibleItems.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Aucun poste ne correspond à la recherche.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {visibleItems.map((item) => (
            <BudgetItemCard
              key={item.id}
              item={item}
              categoryTotal={categoryTotal}
              barColorClass={CATEGORY_BAR_COLOR[category]}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
