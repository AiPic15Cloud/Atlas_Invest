import { useState } from "react";
import { BudgetItemForm } from "./BudgetItemForm";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import type { BudgetItemNode } from "../api/types";

interface BudgetItemRowProps {
  item: BudgetItemNode;
  depth?: number;
  onAddChild: (parentId: string, data: { name: string; monthlyAmount: number; essential: boolean }) => Promise<void>;
  onUpdate: (id: string, data: { name: string; monthlyAmount: number; essential: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => Promise<void>;
}

export function BudgetItemRow({ item, depth = 0, onAddChild, onUpdate, onDelete, onMove }: BudgetItemRowProps) {
  const currency = useCurrencyFormatter();
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);

  return (
    <li style={{ marginLeft: depth * 20 }} className="border-b border-slate-100 dark:border-slate-800 py-2 last:border-0">
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
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {item.name}
              {!item.essential && (
                <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-500">
                  autre
                </span>
              )}
              {item.children.length > 0 && (
                <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-500">
                  détaillé
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="mr-2 text-sm font-semibold">{currency.format(item.displayedAmount)}</span>
            <button onClick={() => onMove(item.id, "up")} className="px-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Monter">
              ↑
            </button>
            <button onClick={() => onMove(item.id, "down")} className="px-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Descendre">
              ↓
            </button>
            <button onClick={() => setAddingChild((v) => !v)} className="px-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
              + sous-dépense
            </button>
            <button onClick={() => setEditing(true)} className="px-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
              Modifier
            </button>
            <button onClick={() => onDelete(item.id)} className="px-1 text-slate-400 hover:text-red-600">
              Supprimer
            </button>
          </div>
        </div>
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
        <ul className="mt-1">
          {item.children.map((child) => (
            <BudgetItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
