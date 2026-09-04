import { useState } from "react";
import { BudgetItemForm } from "./BudgetItemForm";
import { BudgetItemRow } from "./BudgetItemRow";
import type { BudgetCategory, BudgetItemNode } from "../api/types";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

interface BudgetCategorySectionProps {
  category: BudgetCategory;
  title: string;
  items: BudgetItemNode[];
  target: number;
  actual: number;
  showTarget: boolean;
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
  onAddItem,
  onAddChild,
  onUpdate,
  onDelete,
  onMove,
}: BudgetCategorySectionProps) {
  const [adding, setAdding] = useState(false);
  const overBudget = showTarget && actual > target;

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
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
      ) : (
        <ul className="mt-2">
          {items.map((item) => (
            <BudgetItemRow
              key={item.id}
              item={item}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
