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

### c. Patrimoine : historique de valorisation — comblé par Lot 10 (section 32)

`AssetValuation` (ajouté au Lot 10) historise chaque valorisation d'un
`WealthItem` : valeur, date, source (`MANUELLE`/`MARCHE`/`ESTIMATION`/
`HISTORIQUE`), note optionnelle. `WealthItem.amount` reste un cache de la
dernière valorisation (utilisé par tous les calculs de patrimoine net
existants) mais ne change plus jamais sans qu'un point de valorisation daté
et sourcé ne l'explique — y compris via l'ancien PATCH générique.
`GET /:id/valuations` expose l'historique complet.

Le Lot 21 ajoute la variation du patrimoine (section 31) séparément :
`WealthSnapshot` (une photo du patrimoine net par utilisateur et par mois,
réécrite à chaque lecture pour le mois en cours mais jamais pour un mois
déjà passé) sert de référence pour calculer `GET /api/wealth/variation`.
La variation totale du mois est décomposée en flux mesurables — épargne et
investissement (catégories `Expense` du mois), capital immobilier
remboursé (somme des `LoanPayment.principalAmount` du mois) — et tout ce
que ces flux n'expliquent pas est affiché comme un solde « à expliquer »
plutôt que présenté comme une fausse « performance des placements » : sans
historique de contribution par actif, impossible d'isoler la performance
réelle des apports avec certitude (doctrine section 2 et 68 : ne jamais
présenter une estimation comme une certitude, ne jamais cacher un écart).
N'apparaît qu'à partir du deuxième mois d'utilisation (aucune photo du
mois précédent avant ça) — assumé et expliqué à l'écran plutôt que
silencieusement absent.

### d. Objectifs : contributions et priorité — comblé partiellement par Lots 8 et 16 (section 19-21)

`GoalContribution` (ajouté au Lot 8) historise chaque contribution
(montant, date, utilisateur) plutôt que de ne garder que le total agrégé
`SavingsGoal.currentAmount` ; le rythme réellement observé est recalculé
depuis cet historique et comparé à `monthlyContribution` (rythme prévu).
`SavingsGoal.priority` (entier, null = non classé) permet de classer les
objectifs (section 20), avec réorganisation depuis le frontend.

Le Lot 16 ajoute `GET /api/savings-goals/surplus-allocation?available=X`,
qui propose une répartition d'un surplus disponible entre les objectifs
non atteints, dans l'ordre de priorité déclaré : chaque objectif reçoit au
plus sa `monthlyContribution` prévue (ou tout son `remaining` si aucune
mensualité n'est définie), le reliquat est reporté sur le suivant, et ce
qui n'a pas pu être affecté est renvoyé comme `leftover` plutôt que
silencieusement ignoré. C'est une fonction pure (`computeSurplusAllocation`,
`apps/api/src/utils/surplusAllocation.ts`), aucune écriture n'est faite :
conformément à la section 21 (« Atlas propose la décision ; il n'a pas
besoin d'exécuter automatiquement un virement bancaire »), le frontend
(page Objectifs) l'affiche comme une simple suggestion — l'utilisateur
reste libre de contribuer manuellement, ou pas.

Reste manquant : la distinction `individuel`/`commun` par objectif.

### e. Enveloppes virtuelles génériques — comblé par Lot 11 (section 18)

`AccountEnvelope` (ajouté au Lot 11) se rattache à n'importe quel
`BankAccount`, distinct de `SavingsEnvelope` (laissé inchangé, propre à
l'épargne de précaution). Le cas d'usage cible de la spec (« Solde Livret
A : 8000 € dont sécurité 4000, voyage 1500, voiture 1000, libre 1500 »)
est reproduit exactement — `allocated`/`free`/`overAllocated` recalculés à
chaque lecture depuis `BankAccount.initialBalance`, jamais stockés en dur,
et le dépassement est signalé plutôt que masqué ou bloqué (le solde réel
peut évoluer après coup).

### f. Aucune notion de provenance de la donnée (sections 2, 67-68)

Aucun modèle ne porte de champ du type `source` (saisie manuelle / importé
/ calculé / estimé). La distinction « certain / estimé / projeté », pourtant
centrale dans la doctrine financière (section 2), n'existe nulle part dans
le schéma — elle est actuellement gérée au cas par cas côté code applicatif
(ex. `hasEstimate` dans la réponse du Tableau de bord), pas comme une
propriété structurée des données.

### g. `AuditLog` — les 4 exemples de la spec couverts (Lots 12-13), section 66

`CorrectionLog` couvre désormais les 4 exemples cités mot pour mot par la
spec : `BUDGET_ITEM_MODIFIED` ("budget courses passé de 350 à 400 €"),
`GOAL_TARGET_MODIFIED` ("objectif passé de 5 000 à 10 000 €"),
`LOAN_MODIFIED` ("prêt modifié") ajoutés au Lot 12, et
`EXPENSE_RECATEGORIZED` (changement de `category` sur une `Expense`)
ajouté au Lot 13 — tous vérifiés par test avec les valeurs exactes de la
spec. Le soft delete lui-même (« privilégier l'archivage ») est amorcé au
Lot 14 sur `Loan` — le cas le plus clairement justifié, puisqu'une
suppression SQL y perdrait en cascade l'historique `LoanPayment` déjà
construit (ventilation capital/intérêts, Lot 5) : `Loan.archivedAt`
(nullable) exclut le prêt du patrimoine net et des listes par défaut sans
supprimer la ligne ni son historique, avec restauration possible. Reste
volontairement non généralisé aux autres modèles (`WealthItem`,
`SavingsGoal`, `Expense`...) — chacun aurait sa propre justification (ou
non) à établir au cas par cas plutôt que par un changement structurel
unique appliqué partout.

### g'. Rapprochement bancaire (section 68) — comblé par Lot 7

`BalanceCheckpoint` (ajouté au Lot 7) porte un point de rapprochement par
compte et par mois : solde constaté déclaré par l'utilisateur, solde
attendu recalculé automatiquement (dernier point + revenus - dépenses ±
transferts sur les mois écoulés), écart stocké et jamais masqué (formule et
exemple de la section 68 vérifiés par test). Chaque nouveau point synchronise
`BankAccount.initialBalance` sur le solde constaté, ce qui documente
explicitement en base l'usage de ce champ décrit en section 4 ci-dessous.

### h. Financement (Phase 8) : rien n'existe encore

`FinancingProject`, `FinancingScenario`, `FinancingOffer`, `MarketRate`,
`FinancingScore` n'ont aucun équivalent actuel. Attendu — c'est la Phase 8,
loin dans l'ordre recommandé (section 76).

### i. Gamification (Phase 5) : comblée pour l'essentiel par les Lots 18-20

Le Lot 18 ajoute `MonthlyChallenge` (section 51) : une cible
d'épargne par foyer et par mois, avec un stretch goal optionnel
obligatoirement supérieur à la cible. Contrairement à `MonthlyGoal`
(« Nos victoires », checklist libre cochée manuellement), l'avancement
n'est jamais saisi ni stocké : il est recalculé à chaque lecture à partir
de l'épargne réellement enregistrée (même somme catégorie `EPARGNE` que
« argent construit » au Tableau de bord), pour ne jamais diverger de ce
chiffre affiché ailleurs. Un seul défi actif par mois — reposer une cible
remplace l'ancienne plutôt que d'en empiler une concurrente.

Le Lot 19 ajoute la série de mois consécutifs avec épargne et les records
personnels (sections 52-53) — sans aucune nouvelle table : `GET
/api/records` reconstruit tout l'historique mensuel (revenu, épargne,
dépenses regrettées) depuis `Income`/`Expense` existants et calcule, à
chaque lecture, la série en cours, le record de série, le meilleur mois
d'épargne, le meilleur taux d'épargne et le meilleur mois de dépenses
regrettées (fonctions pures `computeSavingsStreak`/`computePersonalRecords`,
testées). Aucune mécanique punitive : un mois sans épargne interrompt
silencieusement la série en cours sans effacer le record déjà atteint, et
« même une petite épargne » (tout montant > 0) suffit à la maintenir.

Le Lot 20 ajoute `SavedEuroEvent` (section 54, « euros sauvés ») : une
dépense volontairement évitée, avec un choix d'affectation obligatoire
(objectif / sécurité / investissement / garder disponible). Contrairement à
un simple journal, le choix a un effet réel quand il en a un : « objectif »
crée une vraie `GoalContribution` et augmente `SavingsGoal.currentAmount`
(même transaction que le flux de contribution manuelle existant),
« sécurité » augmente `EmergencyFundProfile.currentSavedAmount` (refusé
avec le même message que `PATCH /emergency-fund/progress` si le
questionnaire n'a pas encore été rempli). « Investissement » et « garder
disponible » n'ont pas d'accumulateur existant à incrémenter : l'événement
est quand même stocké, ce qui suffit à satisfaire la doctrine (« affectée
ou au moins enregistrée comme telle ») sans fabriquer un total qui
n'existe nulle part ailleurs. Ne touche jamais `Income`/`Expense` — ce
n'est pas un flux réel, seulement une trace de décision, donc aucun risque
de double compter une même somme dans le calcul de l'épargne réelle
(records du Lot 19, Tableau de bord).

Reste manquant en Phase 5 : niveaux financiers (section 58, explicitement
« phase ultérieure » dans la spec), sweep hebdomadaire et défis
hebdomadaires (sections 55-56) — non traités, plus proches d'une
automatisation bancaire réelle (prélèvement automatique) que du reste de
cette maquette pédagogique.

### j. Nature des flux — revenus comblés par Lot 15, sorties/transferts déjà couverts (section 9)

`Income.nature` (ajouté au Lot 15 : `RECURRENT`/`EXCEPTIONNEL`/
`REMBOURSEMENT`/`AUTRE`, défaut `RECURRENT` pour rester rétrocompatible)
distingue désormais un salaire récurrent d'une prime ponctuelle, exposée
sur la page Revenus (badge + total non récurrent du mois affiché
séparément). Pour les sorties, la taxonomie de la spec (consommation /
épargne / investissement / remboursement de capital / intérêts /
assurance / frais financiers) est déjà couverte par construction ailleurs
— catégories `BudgetCategory`, ventilation `LoanPayment` (Lot 5) — sans
qu'un champ `nature` dédié sur `Expense` soit nécessaire. Pour les
transferts, la sous-taxonomie (personnel→livret, personnel→joint,
livret→courant...) n'existe pas explicitement mais se déduit déjà des
types de comptes source/destination (`BankAccountType`) ; non ajoutée ici
faute d'un besoin d'affichage concret identifié.

### k. Mois à risque (section 29) — comblé par Lot 17

`AnticipatedExpense` (ajouté au Lot 17) porte une dépense ponctuelle future
déjà connue (libellé, montant, mois/année cible) — Noël, impôts, gros
entretien — qui n'est ni une échéance récurrente (`RecurringCharge`) ni
encore survenue. `GET /api/risky-months` projette les 6 prochains mois à
partir d'un revenu de référence (revenu récurrent du mois en cours,
`Income.nature = RECURRENT`) et de charges de référence (`RecurringCharge`
actives + `Provision` actives déjà mensualisées), en y ajoutant les
dépenses anticipées déclarées pour chaque mois ; un mois est signalé
« probablement tendu » dès que les charges projetées dépassent le revenu
projeté, avec le versement mensuel qu'il faudrait provisionner d'ici là
pour lisser l'écart (fonction pure `computeRiskyMonths`, testée). Reste une
estimation assumée comme telle (aucun revenu récurrent déclaré ⇒ l'UI le
dit explicitement plutôt que d'afficher un chiffre trompeur) — conforme à
la doctrine « ne jamais présenter une estimation comme une certitude ».

## 3. Vérification du garde-fou « jamais compter un transfert deux fois »

Vérifié dans `apps/api/src/routes/transfers.ts` et le schéma : un virement
est stocké exclusivement dans la table `Transfer`, jamais recopié dans
`Income` ou `Expense`. Aucun calcul de revenu/dépense annuel ou mensuel ne
lit la table `Transfer`. **Le garde-fou de la section 78 est respecté par
construction pour les virements déjà enregistrés comme tels.**

Point de vigilance comblé par Lot 9 : `findTransferCandidates` (appariement
1-1 par année/mois/montant sur des comptes différents du foyer) détecte les
paires `Expense`/`Income` qui ressemblent à un virement mal saisi et le
signale sur la page Transferts — jamais de conversion automatique,
toujours une action explicite (convertir en `Transfer`, ou écarter la
suggestion via `CorrectionLog` type `TRANSFER_SUGGESTION_DISMISSED`).
Limite connue : la fenêtre de détection est glissante sur 6 mois et la date
du virement converti est approximée au 1er du mois (Income/Expense n'ont
pas de date exacte) — signalé explicitement dans la note du virement créé.

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
