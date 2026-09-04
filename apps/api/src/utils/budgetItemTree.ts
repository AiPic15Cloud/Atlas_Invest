import type { BudgetItem } from "@prisma/client";

export interface SerializedBudgetItem {
  id: string;
  category: string;
  name: string;
  monthlyAmount: number;
  displayedAmount: number;
  essential: boolean;
  sortOrder: number;
  parentId: string | null;
  children: SerializedBudgetItem[];
}

export function buildItemTree(items: BudgetItem[]): SerializedBudgetItem[] {
  const byParent = new Map<string | null, BudgetItem[]>();
  for (const item of items) {
    const key = item.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(item);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function toNode(item: BudgetItem): SerializedBudgetItem {
    const children = (byParent.get(item.id) ?? []).map(toNode);
    const displayedAmount =
      children.length > 0 ? children.reduce((sum, c) => sum + c.displayedAmount, 0) : Number(item.monthlyAmount);
    return {
      id: item.id,
      category: item.category,
      name: item.name,
      monthlyAmount: Number(item.monthlyAmount),
      displayedAmount,
      essential: item.essential,
      sortOrder: item.sortOrder,
      parentId: item.parentId,
      children,
    };
  }

  return (byParent.get(null) ?? []).map(toNode);
}

/** Postes "feuilles" a plat : les postes sans sous-depenses, et les sous-depenses elles-memes (jamais un parent qui a des enfants, dont le montant est deja compte via ses enfants). */
export function flattenLeafItems(tree: SerializedBudgetItem[]): SerializedBudgetItem[] {
  const leaves: SerializedBudgetItem[] = [];
  for (const node of tree) {
    if (node.children.length > 0) {
      leaves.push(...flattenLeafItems(node.children));
    } else {
      leaves.push(node);
    }
  }
  return leaves;
}
