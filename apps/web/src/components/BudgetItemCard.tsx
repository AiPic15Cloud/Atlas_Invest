import { useState } from "react";
import { BudgetItemForm } from "./BudgetItemForm";
import { BudgetItemRow } from "./BudgetItemRow";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import type { BudgetItemNode } from "../api/types";

interface BudgetItemCardProps {
  item: BudgetItemNode;
  categoryTotal: number;
  barColorClass: string;
  onAddChild: (parentId: string, data: { name: string; monthlyAmount: number; essential: boolean }) => Promise<void>;
  onUpdate: (id: string, data: { name: string; monthlyAmount: number; essential: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => Promise<void>;
}

export function BudgetItemCard({ item, categoryTotal, barColorClass, onAddChild, onUpdate, onDelete, onMove }: BudgetItemCardProps) {
  const currency = useCurrencyFormatter();
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);

  const pct = categoryTotal > 0 ? Math.min(100, (item.displayedAmount / categoryTotal) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      {editing ? (
        <BudgetItemForm
          initialName={item.name}
          initialAmount={item.monthlyAmount}
          initialEssential={item.essential}
          submitLabel="Enregistrer"
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            await onUpdate(item.id, data);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">
              {item.name}
              {!item.essential && (
                <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-500">autre</span>
              )}
            </p>
            <div className="flex shrink-0 items-center gap-1 text-xs">
              <button onClick={() => onMove(item.id, "up")} className="px-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Monter">↑</button>
              <button onClick={() => onMove(item.id, "down")} className="px-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Descendre">↓</button>
              <button onClick={() => onDelete(item.id)} className="px-1 text-slate-400 hover:text-red-600" aria-label="Supprimer">✕</button>
            </div>
          </div>
          <p className="mt-1 text-lg font-semibold">
            {currency.format(item.displayedAmount)} <span className="text-xs font-normal text-slate-400">/mois</span>
          </p>
          <p className="text-xs text-slate-500">
            {Math.round(pct)}% de votre budget · {currency.format(item.displayedAmount * 12)} /an
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div style={{ width: `${pct}%` }} className={`h-full ${barColorClass}`} />
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            <button onClick={() => setAddingChild((v) => !v)} className="link">+ sous-dépense</button>
            <button onClick={() => setEditing(true)} className="link">Modifier</button>
          </div>
        </>
      )}

      {addingChild && (
        <BudgetItemForm
          submitLabel="Ajouter"
          onCancel={() => setAddingChild(false)}
          onSubmit={async (data) => {
            await onAddChild(item.id, data);
            setAddingChild(false);
          }}
        />
      )}

      {item.children.length > 0 && (
        <ul className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
          {item.children.map((child) => (
            <BudgetItemRow
              key={child.id}
              item={child}
              depth={0}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
