import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { BudgetCategorySection } from "../components/BudgetCategorySection";
import { parseQuickExpense } from "../lib/parseQuickExpense";
import { useCurrencyFormatter } from "../lib/useCurrencyFormatter";
import type { BudgetCategory, BudgetMethodKey, BudgetTemplateResponse } from "../api/types";

export function BudgetType() {
  const currency = useCurrencyFormatter();
  const [data, setData] = useState<BudgetTemplateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changingMethod, setChangingMethod] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const [search, setSearch] = useState("");
  const [quickAddText, setQuickAddText] = useState("");
  const [quickAddCategory, setQuickAddCategory] = useState<BudgetCategory>("BESOINS");
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await apiFetch<BudgetTemplateResponse>("/api/budget-template");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger le budget type.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveTemplate(method: BudgetMethodKey, monthlyIncome: number) {
    await apiFetch("/api/budget-template", { method: "PUT", body: JSON.stringify({ method, monthlyIncome }) });
    setChangingMethod(false);
    setEditingIncome(false);
    await load();
  }

  async function addItem(category: BudgetCategory, item: { name: string; monthlyAmount: number; essential: boolean }) {
    await apiFetch("/api/budget-template/items", { method: "POST", body: JSON.stringify({ category, ...item }) });
    await load();
  }

  async function addChild(parentId: string, item: { name: string; monthlyAmount: number; essential: boolean }) {
    // La categorie du parent est deja fixee cote serveur ; on la retrouve depuis l'arbre local.
    const category = findCategory(parentId);
    await apiFetch("/api/budget-template/items", {
      method: "POST",
      body: JSON.stringify({ category, parentId, ...item }),
    });
    await load();
  }

  function findCategory(itemId: string): BudgetCategory {
    if (!data?.template) return "BESOINS";
    for (const cat of ["besoins", "envies", "epargne"] as const) {
      const stack = [...data.template.items[cat]];
      while (stack.length) {
        const node = stack.pop()!;
        if (node.id === itemId) return node.category;
        stack.push(...node.children);
      }
    }
    return "BESOINS";
  }

  async function updateItem(id: string, item: { name: string; monthlyAmount: number; essential: boolean }) {
    await apiFetch(`/api/budget-template/items/${id}`, { method: "PATCH", body: JSON.stringify(item) });
    await load();
  }

  async function deleteItem(id: string) {
    if (!confirm("Supprimer ce poste ? Ses éventuelles sous-dépenses seront supprimées aussi.")) return;
    await apiFetch(`/api/budget-template/items/${id}`, { method: "DELETE" });
    await load();
  }

  async function moveItem(id: string, direction: "up" | "down") {
    await apiFetch(`/api/budget-template/items/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) });
    await load();
  }

  async function handleQuickAdd() {
    setQuickAddError(null);
    const parsed = parseQuickExpense(quickAddText);
    if (!parsed) {
      setQuickAddError("Indique un montant, ex. « courses 280€ ».");
      return;
    }
    await addItem(quickAddCategory, { name: parsed.poste, monthlyAmount: parsed.amount, essential: true });
    setQuickAddText("");
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Chargement...</p>;

  if (!data.template || changingMethod) {
    return (
      <MethodPicker
        methods={data.methods}
        initialMethod={data.template?.method}
        initialIncome={data.template?.monthlyIncome}
        onCancel={data.template ? () => setChangingMethod(false) : undefined}
        onSubmit={saveTemplate}
      />
    );
  }

  const { template } = data;
  const method = data.methods[template.method];
  const showTargets = method.splitMode !== "ZERO_BASED";
  const { breakdown } = template;
  const margeLibre = template.monthlyIncome - breakdown.besoinsTarget - breakdown.enviesTarget - breakdown.epargneTarget;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">🧭 Mon plan</h1>
          <p className="text-sm text-slate-500">{method.label}</p>
        </div>
        <button onClick={() => setChangingMethod(true)} className="text-sm link">
          Changer de méthode
        </button>
      </div>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Revenu de référence</h2>
          {!editingIncome && (
            <button onClick={() => setEditingIncome(true)} className="text-sm link">
              Modifier
            </button>
          )}
        </div>
        {editingIncome ? (
          <IncomeOnlyForm
            initial={template.monthlyIncome}
            onCancel={() => setEditingIncome(false)}
            onSubmit={(income) => saveTemplate(template.method, income)}
          />
        ) : (
          // Ordre imposé par la spec : revenus habituels, charges essentielles,
          // envies/loisirs, épargne prévue, marge libre — avant tout détail par
          // poste, pour répondre d'abord à "avec mes revenus, combien puis-je
          // raisonnablement dépenser ?".
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-slate-600">💶 Revenus habituels</dt>
              <dd className="text-base font-semibold">{currency.format(template.monthlyIncome)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-slate-600">🏠 Charges essentielles</dt>
              <dd className="font-medium">{currency.format(breakdown.besoinsTarget)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-slate-600">💕 Envies / loisirs</dt>
              <dd className="font-medium">{currency.format(breakdown.enviesTarget)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-slate-600">💰 Épargne prévue</dt>
              <dd className="font-medium">{currency.format(breakdown.epargneTarget)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-slate-600">🆓 Marge libre</dt>
              <dd className={`font-medium ${margeLibre < 0 ? "text-red-600" : ""}`}>{currency.format(margeLibre)}</dd>
            </div>
          </dl>
        )}

        {showTargets && (
          <SplitBar
            besoins={breakdown.besoinsTarget}
            envies={breakdown.enviesTarget}
            epargne={breakdown.epargneTarget}
            total={template.monthlyIncome}
          />
        )}
      </section>

      <ScenarioComparison
        methods={data.methods}
        monthlyIncome={template.monthlyIncome}
        activeMethod={template.method}
        onChoose={(key) => saveTemplate(key, template.monthlyIncome)}
      />

      <section className="card">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un poste..."
            className="min-w-[160px] flex-1 basis-full input sm:basis-auto"
            aria-label="Rechercher un poste"
          />
          <select
            value={quickAddCategory}
            onChange={(e) => setQuickAddCategory(e.target.value as BudgetCategory)}
            className="basis-full input px-2 py-2 text-sm sm:basis-auto"
            aria-label="Catégorie du nouveau poste"
          >
            <option value="BESOINS">Besoins</option>
            <option value="ENVIES">Envies</option>
            <option value="EPARGNE">Épargne</option>
          </select>
          <input
            value={quickAddText}
            onChange={(e) => setQuickAddText(e.target.value)}
            placeholder="Ajoutez un poste, ex. : courses 280€"
            className="min-w-[200px] flex-1 basis-full input sm:basis-auto"
          />
          <button onClick={handleQuickAdd} className="btn btn-primary w-full sm:w-auto">
            Ajouter
          </button>
        </div>
        {quickAddError && <p className="mt-2 text-xs text-red-600">{quickAddError}</p>}
      </section>

      <BudgetCategorySection
        category="BESOINS"
        title="Besoins"
        items={template.items.besoins}
        target={breakdown.besoinsTarget}
        actual={breakdown.besoinsActual}
        showTarget={showTargets}
        search={search}
        onAddItem={addItem}
        onAddChild={addChild}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onMove={moveItem}
      />
      <BudgetCategorySection
        category="ENVIES"
        title="Envies / Loisirs"
        items={template.items.envies}
        target={breakdown.enviesTarget}
        actual={breakdown.enviesActual}
        showTarget={showTargets}
        search={search}
        onAddItem={addItem}
        onAddChild={addChild}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onMove={moveItem}
      />
      <BudgetCategorySection
        category="EPARGNE"
        title="Épargne"
        items={template.items.epargne}
        target={breakdown.epargneTarget}
        actual={breakdown.epargneActual}
        showTarget={showTargets}
        search={search}
        onAddItem={addItem}
        onAddChild={addChild}
        onUpdate={updateItem}
        onDelete={deleteItem}
        onMove={moveItem}
      />
    </div>
  );
}


function SplitBar({ besoins, envies, epargne, total }: { besoins: number; envies: number; epargne: number; total: number }) {
  const currency = useCurrencyFormatter();
  const safeTotal = total > 0 ? total : besoins + envies + epargne || 1;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / safeTotal) * 100));
  return (
    <div className="mt-4">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
        <div style={{ width: `${pct(besoins)}%` }} className="bg-amber-500" title={`Besoins ${currency.format(besoins)}`} />
        <div style={{ width: `${pct(envies)}%` }} className="bg-pink-500" title={`Envies ${currency.format(envies)}`} />
        <div style={{ width: `${pct(epargne)}%` }} className="bg-violet-500" title={`Épargne ${currency.format(epargne)}`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        <span><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Besoins {currency.format(besoins)}</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-pink-500" /> Envies {currency.format(envies)}</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-violet-500" /> Épargne {currency.format(epargne)}</span>
      </div>
    </div>
  );
}

// Calcule les 3 montants cibles d'une méthode à répartition fixe ou en
// cascade pour un revenu donné, sans dépendre d'un budget type déjà créé —
// permet de comparer des scénarios avant de valider une méthode figée.
function computeScenarioTargets(
  def: BudgetTemplateResponse["methods"][BudgetMethodKey],
  monthlyIncome: number,
): { besoins: number; envies: number; epargne: number } | null {
  if (def.splitMode === "FIXED") {
    return {
      besoins: (monthlyIncome * (def.besoinsPct ?? 0)) / 100,
      envies: (monthlyIncome * (def.enviesPct ?? 0)) / 100,
      epargne: (monthlyIncome * (def.epargnePct ?? 0)) / 100,
    };
  }
  if (def.splitMode === "CASCADE") {
    const besoins = (monthlyIncome * (def.besoinsPct ?? 0)) / 100;
    const epargne = (monthlyIncome * (def.epargnePct ?? 0)) / 100;
    return { besoins, envies: monthlyIncome - besoins - epargne, epargne };
  }
  return null;
}

function ScenarioComparison({
  methods,
  monthlyIncome,
  activeMethod,
  onChoose,
}: {
  methods: BudgetTemplateResponse["methods"];
  monthlyIncome: number;
  activeMethod: BudgetMethodKey;
  onChoose: (method: BudgetMethodKey) => void;
}) {
  const currency = useCurrencyFormatter();
  const [choosing, setChoosing] = useState<BudgetMethodKey | null>(null);

  const scenarios = (Object.entries(methods) as [BudgetMethodKey, BudgetTemplateResponse["methods"][BudgetMethodKey]][])
    .map(([key, def]) => ({ key, def, targets: computeScenarioTargets(def, monthlyIncome) }))
    .filter((s): s is { key: BudgetMethodKey; def: BudgetTemplateResponse["methods"][BudgetMethodKey]; targets: { besoins: number; envies: number; epargne: number } } => s.targets !== null);

  async function handleChoose(key: BudgetMethodKey) {
    setChoosing(key);
    try {
      await onChoose(key);
    } finally {
      setChoosing(null);
    }
  }

  return (
    <section className="card">
      <h2 className="font-semibold">🔍 Comparer les scénarios de répartition</h2>
      <p className="mt-1 text-xs text-slate-500">
        À revenu constant ({currency.format(monthlyIncome)}), voici ce que donnerait chaque méthode — pour comparer
        avant de choisir.
      </p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {scenarios.map(({ key, def, targets }) => {
          const isActive = key === activeMethod;
          return (
            <div
              key={key}
              className={`w-56 shrink-0 rounded-lg border p-3 ${
                isActive ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-sm font-medium">{def.label}</p>
              <dl className="mt-2 space-y-1 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <dt>🏠 Besoins</dt>
                  <dd className="font-medium text-slate-800">{currency.format(targets.besoins)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>💕 Envies</dt>
                  <dd className="font-medium text-slate-800">{currency.format(targets.envies)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>💰 Épargne</dt>
                  <dd className="font-semibold text-emerald-600">{currency.format(targets.epargne)}</dd>
                </div>
              </dl>
              {isActive ? (
                <p className="mt-3 text-center text-xs font-medium text-violet-600">Méthode actuelle</p>
              ) : (
                <button
                  onClick={() => handleChoose(key)}
                  disabled={choosing !== null}
                  className="mt-3 w-full rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {choosing === key ? "..." : "Choisir cette méthode"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function IncomeOnlyForm({ initial, onCancel, onSubmit }: { initial: number; onCancel: () => void; onSubmit: (v: number) => Promise<void> }) {
  const [value, setValue] = useState(String(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Montant invalide.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(parsed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 flex items-end gap-2">
      <div>
        <label htmlFor="monthly-income" className="mb-1 block text-xs font-medium text-slate-700">
          Revenu mensuel de référence (€)
        </label>
        <input
          id="monthly-income"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-40 input px-2 py-1.5 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-md bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        Enregistrer
      </button>
      <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
        Annuler
      </button>
    </div>
  );
}

function MethodPicker({
  methods,
  initialMethod,
  initialIncome,
  onCancel,
  onSubmit,
}: {
  methods: BudgetTemplateResponse["methods"];
  initialMethod?: BudgetMethodKey;
  initialIncome?: number;
  onCancel?: () => void;
  onSubmit: (method: BudgetMethodKey, income: number) => Promise<void>;
}) {
  const [method, setMethod] = useState<BudgetMethodKey | undefined>(initialMethod);
  const [income, setIncome] = useState(initialIncome !== undefined ? String(initialIncome) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!method) {
      setError("Choisis une méthode.");
      return;
    }
    const parsedIncome = Number(income.replace(",", "."));
    if (!Number.isFinite(parsedIncome) || parsedIncome < 0) {
      setError("Revenu invalide.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(method, parsedIncome);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {initialMethod ? "📁 Changer de méthode de budget" : "📁 Construis ton budget type"}
      </h1>
      <p className="text-sm text-slate-600">
        Choisis la méthode de budgétisation qui te servira de référence pour comparer tes dépenses réelles.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.entries(methods) as [BudgetMethodKey, BudgetTemplateResponse["methods"][BudgetMethodKey]][]).map(
          ([key, def]) => (
            <button
              key={key}
              onClick={() => setMethod(key)}
              className={`rounded-lg border p-3 text-left transition ${
                method === key ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-medium">{def.label}</p>
              <p className="mt-1 text-xs text-slate-500">{def.description}</p>
            </button>
          ),
        )}
      </div>

      <div className="card">
        <label htmlFor="picker-income" className="mb-1 block text-sm font-medium text-slate-700">
          Revenu mensuel de référence (€)
        </label>
        <input
          id="picker-income"
          inputMode="decimal"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          placeholder="Ex. 3000"
          className="w-48 input"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? "Enregistrement..." : initialMethod ? "Enregistrer" : "Créer mon budget type"}
          </button>
          {onCancel && (
            <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
