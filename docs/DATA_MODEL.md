# Atlas Invest — Cartographie du modèle de données actuel

> Lot 2 (Phase 0 — Audit et stabilisation, `docs/SPEC.md` section 76) :
> "cartographier le modèle actuel" et "identifier les données existantes à
> migrer". Ce document compare le schéma Prisma existant
> (`apps/api/prisma/schema.prisma`, 22 modèles) à la cible décrite en
> section 74/75 de la spec, et liste les écarts à traiter dans les lots à
> venir. Aucun changement de code dans ce lot — audit uniquement.

## 1. Ce qui existe déjà et correspond à la cible

| Modèle actuel | Cible spec (section 74) | État |
|---|---|---|
| `User` | `User` | Conforme, plus riche (2FA, préférence de partage) |
| `Household` | `Household` | Conforme (règle de répartition inline : `splitMode`/`splitCustomShares`, devise, mois fiscal) |
| `BankAccount` | `Account` | Conforme dans l'usage, voir écart de nommage ci-dessous |
| `Transfer` | `Transfer` | **Conforme au garde-fou** — table dédiée, jamais insérée dans Income/Expense (voir §3) |
| `BudgetTemplate` + `BudgetItem` + `MonthlyBudgetOverride` | `BudgetPlan` + `MonthlyBudget` | Conforme, nommage différent |
| `RecurringCharge` | `RecurringPayment` | Conforme, nommage différent |
| `Subscription` | `Subscription` | Conforme (détection auto + enrichissement manuel) |
| `EmergencyFundProfile` + `SavingsEnvelope` | Épargne de précaution + enveloppes (§18/22) | Conforme pour l'épargne de précaution |
| `SavingsGoal` | `SavingsGoal` | Partiel, voir §2 |
| `ImportCategoryMemory` | `CategorizationRule` | Conforme dans l'esprit (règle par marchand) |
| `Loan` | `Loan` | Partiel, voir §2 |
| `WealthItem` | `Asset` / `Liability` | Partiel, voir §2 |
| `CorrectionLog` | `AuditLog` | Partiel, voir §2 |
| `MonthlyGoal` | — (gamification "Nos victoires") | Fonctionnalité existante, distincte des mécaniques de gamification cible (§50-58, non commencées) |

## 2. Écarts structurels à combler (par lot, pas tous à la fois)

### a. Pas de `Transaction` unifiée ni de `TransactionSplit` (section 10)

`Income` et `Expense` sont deux modèles séparés, chacun avec un seul
montant et une seule catégorie. Le modèle cible utilise une `Transaction`
générique avec des `TransactionSplit` pour découper un même mouvement
(ex. 100 € → 60 € commun / 40 € personnel, ou une échéance de crédit →
capital / intérêts / assurance).

`ExpenseAssignment` existe déjà mais ne couvre qu'un cas particulier : une
`Expense` a au plus **une** assignation à **un** membre (`expenseId` est
`@unique`) — pas de découpage en plusieurs parts, pas de split
besoin/envie sur une même dépense. Un vrai split multi-parts nécessiterait
soit de généraliser `ExpenseAssignment` en table multi-lignes avec montant
par ligne, soit de migrer vers le modèle `Transaction`/`TransactionSplit`
cible. À traiter comme un lot dédié — c'est un changement de schéma qui
touche `Expense`, `ExpenseAssignment`, et tous les endpoints qui les lisent.

### b. Prêts : pas de ventilation capital/intérêts/assurance (section 34-35)

`Loan` a `remainingBalance` et `monthlyPayment` comme champs plats, mis à
jour manuellement. Il n'y a pas de `LoanPayment`/`LoanSchedule` qui
enregistre, mensualité par mensualité, la répartition capital / intérêts /
assurance — nécessaire pour que le patrimoine distingue correctement
« consommé » (intérêts, assurance) de « dette remboursée » (capital),
comme l'exige la section 34.

### c. Patrimoine : pas d'historique de valorisation (section 32)

`WealthItem` porte `amount` + `updatedAt`, sans distinguer la nature de la
valeur (saisie manuelle / marché / estimation / historique) ni conserver
un historique (`AssetValuation`). Toute mise à jour écrase la valeur
précédente — impossible de reconstituer « performance des placements »
séparément des flux apportés (section 31) sans cet historique.

### d. Objectifs : pas de contributions ni de priorité (section 19-20)

`SavingsGoal.currentAmount` est un compteur unique, pas une liste de
`GoalContribution` par utilisateur et par date. Pas de champ `priority` ni
`individuel`/`commun`. La comparaison « rythme prévu vs réellement observé »
(section 19) n'est donc pas calculable finement aujourd'hui.

### e. Enveloppes virtuelles limitées à l'épargne de précaution (section 18)

`SavingsEnvelope` est rattachée à `EmergencyFundProfile`, pas à un compte
quelconque. Le cas d'usage cible (« Solde Livret A : 8000 € dont sécurité
4000, voyage 1500, voiture 1000, libre 1500 ») demande des enveloppes sur
n'importe quel compte, pas seulement sur l'épargne de précaution.

### f. Aucune notion de provenance de la donnée (sections 2, 67-68)

Aucun modèle ne porte de champ du type `source` (saisie manuelle / importé
/ calculé / estimé). La distinction « certain / estimé / projeté », pourtant
centrale dans la doctrine financière (section 2), n'existe nulle part dans
le schéma — elle est actuellement gérée au cas par cas côté code applicatif
(ex. `hasEstimate` dans la réponse du Tableau de bord), pas comme une
propriété structurée des données.

### g. `AuditLog` très partiel (section 66)

`CorrectionLog` ne couvre que deux types (`WASTEFUL_EXPENSE`,
`SUBSCRIPTION_STATUS`). Les autres changements que la spec veut historiser
— budget modifié, objectif modifié, transaction recatégorisée, prêt modifié
— ne sont pas journalisés.

### h. Financement (Phase 8) : rien n'existe encore

`FinancingProject`, `FinancingScenario`, `FinancingOffer`, `MarketRate`,
`FinancingScore` n'ont aucun équivalent actuel. Attendu — c'est la Phase 8,
loin dans l'ordre recommandé (section 76).

### i. Gamification (Phase 5) : rien n'existe encore

`Challenge`, `SavedEuroEvent`, streaks, records — aucun équivalent. `
MonthlyGoal` (« Nos victoires ») est une checklist libre, pas un moteur de
défi avec avancement calculé sur l'épargne réelle. Attendu — Phase 5.

## 3. Vérification du garde-fou « jamais compter un transfert deux fois »

Vérifié dans `apps/api/src/routes/transfers.ts` et le schéma : un virement
est stocké exclusivement dans la table `Transfer`, jamais recopié dans
`Income` ou `Expense`. Aucun calcul de revenu/dépense annuel ou mensuel ne
lit la table `Transfer`. **Le garde-fou de la section 78 est respecté par
construction pour les virements déjà enregistrés comme tels.**

Point de vigilance qui reste ouvert : rien n'empêche aujourd'hui un
virement bancaire d'être saisi par erreur comme une `Expense` (sortie) sur
un compte et une `Income` (entrée) sur un autre — l'import bancaire et la
saisie manuelle n'ont pas de détection qui suggère « ceci ressemble à un
virement interne, pas à une vraie dépense/un vrai revenu ». C'est un futur
lot (probablement rattaché à la Phase 1, section 9).

## 4. `initialBalance` : nommage trompeur, pas un bug de calcul

`BankAccount.initialBalance` est modifiable via `PATCH /api/bank-accounts/:id`
(voir `apps/api/src/routes/bankAccounts.ts`) et sert en pratique de **solde
actuel maintenu manuellement**, pas d'un solde d'ouverture figé. Le
Tableau de bord (`currentBalance = somme des initialBalance`) est donc
cohérent avec la doctrine « Solde actuel des comptes » de la section 5 —
ce n'est **pas** une confusion de calcul. Mais le nom du champ induit en
erreur quiconque lit le schéma en pensant qu'il faudrait le combiner aux
revenus/dépenses depuis la création du compte pour obtenir le solde réel :
ce n'est pas le cas, c'est l'utilisateur qui le tient à jour. À renommer
(`currentBalance`) dans un futur lot de nettoyage plutôt que dans ce lot
d'audit — un renommage de colonne touche une migration Prisma et tous les
call sites, donc mérite son propre lot scopé.

## 5. Données existantes à migrer (pour préparer les lots futurs)

- **Splits (§2a)** : au moment d'introduire `TransactionSplit`, chaque
  `Expense` existante devient un split unique à 100 % sur sa propre
  catégorie — migration triviale, pas de perte d'information.
- **Prêts (§2b)** : les `Loan` existants n'ont pas d'historique de
  mensualités à migrer (le champ `remainingBalance` est déjà le seul état
  connu) — la ventilation capital/intérêts/assurance ne pourra démarrer
  qu'à partir de la prochaine mensualité saisie, pas rétroactivement.
- **Patrimoine (§2c)** : idem, un `WealthItem` existant devient la première
  ligne d'historique (`AssetValuation`) le jour de la migration, sans
  historique antérieur reconstituable.
- **Objectifs (§2d)** : `SavingsGoal.currentAmount` existant devient une
  première `GoalContribution` de rattrapage (montant = valeur actuelle,
  date = date de migration), pour ne pas perdre la progression déjà
  enregistrée.
