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

### b. Prêts : ventilation, cockpit dette et remboursement anticipé — comblés par Lots 5, 22 et 23 (section 34-36)

`LoanPayment` (ajouté au Lot 5, avant ce document) enregistre, mensualité
par mensualité, la répartition capital / intérêts / assurance ; seule la
part capital réduit `Loan.remainingBalance` et compte comme dette
remboursée, distincte de ce qui est consommé (section 34).

Le Lot 22 ajoute le cockpit dette (section 35) sans nouvelle table : `GET
/api/loans/cockpit` agrège les prêts actifs (dette totale empruntée,
capital restant dû, mensualités cumulées, part des revenus qui y est
consacrée, prochaine mensualité libérée) et projette, prêt par prêt, la
durée restante et les intérêts qui restent à payer via un amortissement
standard quand le taux est connu — jamais une fausse précision : si le
taux manque, l'estimation des intérêts reste explicitement « non
disponible » plutôt qu'un chiffre inventé (doctrine section 39, même
principe que le TAEG), et un prêt dont la mensualité ne couvre même pas les
intérêts est signalé comme ne pouvant jamais être remboursé à ce rythme
plutôt que de produire une date de fin absurde. La liste des prêts
(`GET /api/loans`) réutilise la même fonction de projection, pour que la
durée restante affichée soit toujours identique entre la fiche d'un prêt et
le cockpit global.

Le Lot 23 ajoute la simulation de remboursement anticipé (section 36,
« Et si je rembourse 5 000 € maintenant ? »), également sans nouvelle
table : `POST /api/loans/:id/simulate-early-repayment` est une pure
lecture — ne modifie jamais `Loan` ni `EmergencyFundProfile` — qui compare,
via la même fonction de projection que le cockpit, la situation du prêt
avant et après un remboursement hypothétique (capital restant dû, durée
restante, intérêts économisés), propose une mensualité réduite alternative
qui conserverait la même date de fin, et signale l'impact sur l'épargne de
précaution quand un profil existe. N'inclut pas d'« impact sur le score de
financement » (section 40) : ce score appartient à la Phase 8, non
commencée — mieux vaut l'omettre que d'inventer un chiffre qui n'existe pas
encore ailleurs dans l'app.

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

Le Lot 33 ajoute `MonthlyChallenge.rewardPercent` (section 57, «
récompense contrôlée ») : quand l'épargne réelle dépasse la cible du défi
mensuel, un pourcentage configurable du dépassement (`null` = fonctionnalité
non activée) devient un « budget plaisir », le reste une épargne
supplémentaire — les deux parts calculées pour sommer exactement au
dépassement même en cas d'arrondi (`computeControlledReward`, testée avec
l'exemple exact de la spec : 600 → 800, 10 % → 20 € plaisir / 180 €
épargne).

Reste manquant en Phase 5, et bloqué par une limite structurelle du modèle
de données plutôt que par un choix de scope : le sweep hebdomadaire et les
défis hebdomadaires (sections 55-56) nécessitent de savoir dans quelle
semaine calendaire une dépense est survenue, or `Expense` ne stocke qu'une
année et un mois (`year`/`month`), jamais un jour précis — cohérent avec
« Mon mois » qui est volontairement une saisie mensuelle, pas un relevé
transaction par transaction daté. Tenter un découpage hebdomadaire sans
cette donnée obligerait à deviner la semaine de chaque dépense, exactement
le type de fausse précision que la doctrine interdit (section 78). Ajouter
une date précise à `Expense` est un changement structurel qui mérite son
propre lot, pas un raccommodage au passage. Niveaux financiers (section
58) restent également non traités, explicitement « phase ultérieure »
dans la spec elle-même.

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

### l. Fuites financières (section 12) — comblé par Lot 24, avec une limite connue

`GET /api/savings-opportunities` expose désormais `potentialLeaks` :
abonnements `NON_EVALUE`/`A_SURVEILLER` (jamais `A_GARDER` ni `A_RESILIER`,
qui appartiennent déjà aux recommandations confirmées ci-dessus), agrégés
en montant mensuel/annuel. Concept explicitement distinct de la section 11
(dépenses regrettées) et des recommandations déjà actées : tant qu'un
abonnement n'est pas évalué, son montant n'est jamais inclus dans
`totalAnnual`/`totalMonthlyEquivalent` (le total réellement réallouable
vers l'épargne) — conforme au principe de la section 12, « le mot
potentielles est important tant que l'utilisateur n'a pas confirmé ».

**Limite connue, héritée du détecteur d'abonnements (étape #28 du projet,
antérieure à ce document — à ne pas confondre avec le « Lot 28 » de la
numérotation utilisée dans ce document, qui désigne autre chose, voir §p) :
corrigée par Lot 29.**

Non traité (section 12) : frais bancaire, doublon de charge (au-delà de la
détection déjà existante au moment de l'import, `ImportStatement.tsx`), et
hausse de prix sur une charge récurrente — aucun signal fiable dans le
modèle de données actuel sans risquer des faux positifs bruyants qui
éroderaient la confiance plutôt que de l'améliorer.

### m. Stress tests (section 60) — comblé par Lot 25

`POST /api/stress-tests/simulate` (aucune nouvelle table — bac à sable pur,
section 59) projette l'effet d'un choc ponctuel : perte de revenu (montant
fixe ou pourcentage), dépense imprévue, ou hausse d'une charge récurrente.
Le rythme de référence est la moyenne mensuelle glissante sur 12 mois —
même convention que `averages.incomePerMonth`/`expensePerMonth` du Tableau
de bord (`computeAnnualTotals`/`computeMonthlyAverages`, Lot 1), réutilisée
telle quelle pour ne jamais afficher une deuxième définition de « moyenne
mensuelle » qui contredirait celle déjà connue de l'utilisateur. Le tampon
disponible est l'épargne de précaution déjà construite
(`EmergencyFundProfile.currentSavedAmount`), jamais le solde bancaire brut
qui inclut de l'argent déjà affecté ailleurs. Distingue explicitement deux
échecs différents plutôt que de les confondre : un tampon insuffisant pour
absorber le choc immédiat (`bufferAfterShock < 0`) peut coexister avec un
rythme mensuel qui resterait positif ensuite (`sustainableIndefinitely`) —
les deux sont montrés séparément côté frontend. Fonction pure testée
(`simulateStressTest`).

### n. Coût complet d'une décision (section 61) — comblé par Lot 26

Nouveau modèle `DecisionCost` (label, userId) + `DecisionCostItem`
(label, monthlyAmount, decisionCostId) via `/api/decision-costs`
(GET/POST/DELETE). Reprend l'exemple même de la section 61 : une décision
d'achat ne se résume pas à sa mensualité de crédit — l'utilisateur liste
tous les composants mensuels réels (crédit, assurance, carburant,
entretien provisionné...) et l'app additionne pour donner un unique
`realMonthlyCost`, sans aucune tentative d'estimer automatiquement des
composants que l'utilisateur n'a pas saisis (pas de fabrication de
carburant/entretien par défaut — ce serait présenter une estimation comme
certaine, contraire au garde-fou 78). Fonction pure testée
(`computeDecisionRealCost`), vérifiée avec l'exemple exact de la spec
(280 + 70 + 140 + 50 = 540 €/mois).

### o. Annualisation des échéances récurrentes (section 13) — comblé par Lot 27

La spec donne l'exemple explicite « 14,99 €/mois → 179,88 €/an » pour les
dépenses récurrentes ; `RecurringCharge` (échéances, section 34) exposait
uniquement le montant mensuel. `GET /api/recurring-charges` calcule
désormais `annualAmount` par échéance (`amount * 12`, arrondi aux
centimes) ainsi que `totalMonthlyActive`/`totalAnnualActive` sur les
échéances actives uniquement (une échéance suspendue ne doit pas gonfler
un total qui prétend refléter l'engagement réel du foyer). Calcul
identique en esprit à celui déjà utilisé pour les abonnements
(`subscriptions.ts`, `savingsOpportunities.ts`) — pas de nouvelle
définition concurrente de « équivalent annuel ». Frontend (Échéances) :
montant annuel affiché sous chaque échéance, total en tête de section.
Pas de fonction pure dédiée (multiplication directe, déjà le précédent
établi pour ce type de calcul trivial ailleurs dans le code) mais vérifié
bout en bout par API avec l'exemple exact de la spec.

### p. Fiabilisation du détecteur d'abonnements (section 12) — comblé par Lot 29

Corrige la limite documentée en §l : le détecteur (`subscriptions.ts`,
`refreshSubscriptions`) confondait un abonnement (Netflix, salle de sport)
avec un poste de budget variable qui revient chaque mois par nature
(Courses, Restaurant) dès que son montant restait stable sur 2 mois par
coïncidence. Logique d'exclusion extraite dans
`utils/subscriptionDetection.ts` (`isExcludedFromSubscriptionDetection`,
testée) et étendue au-delà de `loyer`/`virement épargne` : courses,
supermarché, marché, épicerie, boulangerie, restaurant, boucherie,
primeur. Choix assumé : un faux négatif (un vrai abonnement nommé « Box
Courses Bio » serait aussi exclu) est préférable à une liste
d'abonnements polluée par du bruit connu — même arbitrage que celui déjà
fait pour loyer/virement épargne.

Bug découvert et corrigé pendant l'écriture des tests : `\b` en
JavaScript ne traite pas les lettres accentuées comme des caractères de
mot, donc une frontière juste après un « é » (ex. « marché ») ne
matchait jamais — le poste est désormais normalisé (accents retirés via
NFD) avant le test, plutôt que de dupliquer chaque mot-clé en version
accentuée.

Cette correction profite aussi bien à la page Abonnements qu'aux Fuites
potentielles du Lot 24, sans toucher à la structure de la détection ni au
modèle de données — exactement le lot qui avait été volontairement
différé. Effet de bord assumé et testé manuellement : un `Subscription`
déjà en base (créé avant ce lot) dont le libellé correspond désormais aux
mots-clés d'exclusion est automatiquement marqué `dismissed` au prochain
rafraîchissement — comme si l'utilisateur avait lui-même confirmé « ce
n'est pas un abonnement », puisque c'est désormais un fait établi plutôt
qu'une hypothèse (jamais de suppression physique, conforme au garde-fou
« préférer l'archivage »).

### q. Simulateur de financement (section 37) — comblé par Lot 30

`POST /api/financing-simulations/simulate` (aucune nouvelle table — bac à
sable pur, comme les stress tests du Lot 25 : ne lit ni ne modifie aucune
donnée réelle du foyer). À partir de montant/apport/durée/taux/assurance/
frais, calcule le montant financé, la mensualité (amortissement classique),
les intérêts totaux, le coût total, et un TAEG estimé.

Distinction volontaire entre une donnée *inconnue* (`undefined`, le champ
n'a pas été renseigné) et une donnée *connue et nulle* (`0`, l'utilisateur a
explicitement indiqué qu'il n'y a pas d'assurance/de frais) — exactement le
type de nuance que le garde-fou anti-fausse-précision (section 78) demande :
- taux d'intérêt non renseigné → `taeg: null`, « TAEG non disponible : taux
  d'intérêt non renseigné » (conforme à la section 39).
- taux connu mais assurance et/ou frais non renseignés (`undefined`) →
  `taeg: null`, « TAEG non disponible : assurance et/ou frais non
  renseignés » — même si tout le reste est calculable, annoncer un TAEG
  sans ces composantes obligatoires serait une fausse précision.
- assurance et frais explicitement fournis, y compris à 0 → TAEG calculé
  par méthode actuarielle (Newton-Raphson sur les flux mensuels réels) et
  systématiquement qualifié d'« estimé », jamais présenté comme le TAEG
  légal exact que seul un établissement bancaire peut certifier.

Volontairement hors périmètre de ce lot (sections 40-43, 45-49 : score de
financement Atlas, verdict Confortable/Tendu, reste à vivre réel, capacité
immobilière, comparaison de scénarios/banques ; le taux d'effort, section
44, est traité séparément par le Lot 31 ci-dessous) — ces fonctionnalités
nécessitent de croiser la simulation avec la situation réelle du foyer
(revenus, épargne, autres charges) et méritent chacune leur propre lot
scopé plutôt qu'un unique gros morceau. Fonction pure testée
(`simulateFinancing`, 8 cas dont la cohérence de l'amortissement et la
distinction `undefined`/`0`).

### r. Taux d'effort avant/après projet (section 44) — comblé par Lot 31

`POST /api/financing-simulations/effort-rate` combine le simulateur de
financement (Lot 30, toujours un calcul pur) avec les données réelles du
foyer : revenu récurrent du mois courant (même source que le Cockpit dette,
Lot 22) et somme des mensualités des prêts actifs non soldés
(`loansFor`, réutilisé tel quel — jamais une deuxième requête qui pourrait
diverger de la liste affichée sur la page Patrimoine). Calcule le taux
d'effort actuel (dette existante / revenu) et après projet (dette existante
+ nouvelle mensualité / revenu), avec une référence configurable
(`referenceRatePercent`, 35 % par défaut — la valeur de l'exemple de la
spec, jamais un seuil « dur »). Si aucun revenu récurrent n'est renseigné
pour le mois, retourne explicitement « non disponible » plutôt que de
diviser par zéro ou d'inventer un taux.

Conforme à la section 43 : jamais de verdict binaire (« Banque : OUI/NON »)
— seuls des pourcentages et une référence indicative sont montrés, la
zone qualitative (Confortable/Tendu...) étant un futur lot séparé qui
nécessite de définir plusieurs seuils, pas seulement un taux d'effort.
Fonction pure testée (`computeEffortRate`), vérifiée avec l'exemple exact
de la spec (24,7 % → 34,3 %).

### s. Reste à vivre réel (section 45) — comblé par Lot 32

Même endpoint `POST /api/financing-simulations/effort-rate`, étendu avec
`realDisposableIncome` : compare le reste théorique après crédit (revenu
récurrent − dette existante − nouvelle mensualité) au train de vie
réellement observé (moyenne mensuelle glissante sur 12 mois, même fenêtre
que les stress tests du Lot 25).

Point de vigilance explicitement traité pour respecter le garde-fou
« jamais compter deux fois » (section 78) : les dépenses observées
excluent la catégorie `REMBOURSEMENT_DETTE`, car ces mensualités sont déjà
comptées via `existingMonthlyDebt` (`Loan.monthlyPayment`) — un
utilisateur qui logue aussi son remboursement de prêt comme dépense
manuelle ne verrait donc jamais ce montant doublé dans la marge réelle.
Vérifié explicitement en ajoutant une dépense `REMBOURSEMENT_DETTE` de
test et en confirmant que `observedMonthlyExpenses` restait inchangé.

Fonction pure testée (`computeRealDisposableIncome`), vérifiée avec
l'exemple exact de la spec (reste après crédit 2 600 € − dépenses
observées 2 250 € = marge réelle 350 €/mois).

### t. Rapport mensuel enrichi (section 72) — comblé par Lot 34

Le rapport CSV (`Export.tsx`, écrit à l'étape #43 du projet, avant la
plupart des lots suivants) ne couvrait que Revenus/Dépenses/Reste à
vivre. La spec section 72 exige aussi : Budget vs réel, Épargne, Euros
sauvés, Fuites détectées, Objectifs, Patrimoine, Crédits, Actions
proposées. Toutes ces sections existaient déjà comme fonctionnalités
testées ailleurs (Lots 18, 20, 24, ainsi que Objectifs/Patrimoine/Crédits
des tout premiers lots) : ce lot se contente de réutiliser ces endpoints
déjà éprouvés côté frontend, sans nouvelle logique de calcul ni nouvelle
route API.

Le patrimoine et les objectifs sont explicitement présentés comme un
« instantané à la date du rapport » plutôt que comme une valeur « du
mois », car ce sont des soldes actuels, pas un flux mensuel — éviter de
laisser croire que le patrimoine du 5 du mois et celui du 28 seraient la
même donnée. Les « euros sauvés » sont filtrés côté client sur
`createdAt` pour ne garder que les évènements du mois sélectionné, cette
table n'ayant pas de filtre par année/mois côté API (elle liste tout
l'historique du foyer, ce qui reste correct pour son propre usage sur la
page Tableau de bord).

Volontairement hors périmètre : l'export JSON de sauvegarde/reconstitution
complète (section 71, « le JSON doit permettre une vraie sauvegarde »)
nécessiterait de traverser un nombre de tables bien plus large (budget
type, abonnements, prêts, objectifs, patrimoine, provisions,
enveloppes...) et mérite son propre lot plutôt que d'être ajouté en
passant à un rapport CSV. Non lié à ce lot mais repéré en vérifiant la
page : `Export.tsx` a gardé la palette violette d'avant le re-skin
« Boutique » (cuivre/terracotta/olive) appliqué au reste de l'app —
purement visuel, sans impact sur les données, laissé pour un lot de
polish séparé.

### u. Revenus variables : revenu moyen et revenu prudent (section 62) — comblé par Lot 35

La spec section 62 se contente d'inviter Atlas à calculer plus tard un
« revenu moyen » et un « revenu prudent » pour une source de revenu
irrégulière (freelance, commissions...), sans fournir d'exemple chiffré
ni de méthode de calcul précise contrairement à d'autres sections — le
calcul ci-dessous a donc été conçu dans les limites de la doctrine du
projet plutôt que copié d'un exemple de la spec.

Nouvelle nature de revenu `IncomeNature.VARIABLE`, distincte de
`RECURRENT`/`EXCEPTIONNEL`/`REMBOURSEMENT`/`AUTRE` (migration
`add_income_nature_variable`). Nouvelle route
`GET /api/incomes/variable-stats` : regroupe les revenus `VARIABLE` du
foyer par source normalisée (`normalizePosteKey`, déjà utilisé pour les
règles de ressenti) sur une fenêtre glissante de 12 mois — jamais
réinitialisée au 1er janvier comme le ferait un découpage par année
civile, pour refléter l'expérience la plus récente d'une source
irrégulière plutôt qu'un historique qui redevient vide chaque janvier.

Pour chaque source : `average` (moyenne arithmétique) et `conservative`
(le minimum réellement observé sur la fenêtre — jamais un percentile, un
écart-type ou une autre extrapolation statistique qui inventerait une
certitude que les données n'ont pas, garde-fou section 78 « jamais
présenter une estimation comme une certitude »). Fonction pure testée
(`computeVariableIncomeStats`), avec un test dédié qui vérifie
explicitement que le revenu prudent reste le minimum littéral même sur
une série à forte variance ([2000, 100, 2000, 2000, 2000] → prudent =
100, pas un percentile lissé qui aurait masqué l'accident).

Vérifié en saisissant deux revenus `VARIABLE` de test sur la même source
(1 500 € et 800 €) : `average` = 1 150 €, `conservative` = 800 €,
`observedMonths` = 2 — conforme au calcul attendu. Le frontend
(`Revenus.tsx`) n'affiche la section que si au moins une source variable
existe sur la fenêtre (`sources.length > 0`), pour ne jamais montrer un
chiffre fabriqué en l'absence de données.

### v. Jeton d'accès personnel + saisie rapide de dépense (raccourci iOS) — Lot 36

Hors spec (demande utilisateur directe, suite à une question sur la
récupération automatique des dépenses Apple Pay) : iOS n'expose aucun
déclencheur d'automatisation Raccourcis sur un paiement Apple Pay (Apple ne
partage pas cette donnée), donc pas de solution « zéro interaction »
possible côté app. Solution retenue : un raccourci en 1 tap qui appelle
l'API directement.

Nouveau modèle `PersonalAccessToken` : jeton distinct de la session JWT,
volontairement scopé à une seule action (créer une dépense sur un compte, un
poste et une catégorie choisis à la création du jeton) plutôt qu'un accès
API complet — pour limiter les dégâts en cas de fuite du jeton (Raccourci
partagé par erreur, capture d'écran...). Seul un hash SHA-256 du jeton est
stocké (déjà 192 bits d'entropie, donc pas besoin du ralentissement
volontaire de bcrypt réservé aux secrets à faible entropie choisis par un
humain) ; la valeur en clair n'est renvoyée par l'API qu'une seule fois, à
la création. Révocation = `revokedAt` (archivage, pas de suppression dure,
même doctrine que le Lot 14 pour les prêts) : l'historique d'usage
(`lastUsedAt`) reste consultable même pour un jeton révoqué.

Routes : `POST/GET /api/personal-tokens` (session JWT habituelle,
`loadAccessibleAccount` vérifie que le compte choisi est bien accessible à
l'utilisateur) et `DELETE /api/personal-tokens/:id` (révocation). Nouvelle
route `POST /api/quick-expense`, protégée par un middleware dédié
(`requirePersonalToken`) distinct de `requireAuth` : un jeton personnel ne
peut jamais s'authentifier sur les routes JWT normales, et inversement —
vérifié explicitement (un jeton JWT valide renvoie 401 sur
`/api/quick-expense`, un jeton personnel valide renvoie 401 sur
`/api/expenses`). Le montant est la seule donnée obligatoire ;
poste/catégorie/compte viennent des valeurs par défaut du jeton pour qu'un
Raccourci iOS reste à une seule question (« Combien ? »). Réutilise
`resolveFeeling` (règle apprise ou suggestion automatique) et
`serializeExpense`, déjà testés dans `expenses.ts`, plutôt que de dupliquer
cette logique.

Frontend (`Settings.tsx`) : section « Raccourci de saisie rapide » —
création du jeton (compte/poste/catégorie), affichage unique de la valeur
en clair avec avertissement explicite, liste des jetons actifs avec
dernier usage, révocation, et instructions repliées (`<details>`) pour
configurer le Raccourci iOS, incluant la mention explicite que le
déclenchement reste manuel (pas d'automatisation Apple Pay possible).

Vérifié en local : création d'un jeton, appel `POST /api/quick-expense`
avec seulement `{"amount": 12.5}` → dépense créée avec le poste/catégorie
par défaut et la note « Ajouté via raccourci » ; jeton JWT rejeté sur
`/api/quick-expense` (401) ; jeton personnel rejeté sur `/api/expenses`
(401) ; après révocation, `/api/quick-expense` renvoie 401 immédiatement.

### w. Revenu professionnel exclu du revenu du foyer (section 63) — comblé par Lot 37

La spec section 63 est explicite : « Un compte professionnel ne doit pas
automatiquement entrer dans le revenu du foyer. » Le type de compte `PRO`
existait déjà depuis les tout premiers lots (choix à la création d'un
compte bancaire) mais n'était traité nulle part différemment d'un compte
courant — tout revenu logué dessus se retrouvait mélangé au revenu
personnel/du foyer dans chaque calcul qui en dépend.

Nouvelle fonction pure `excludeProfessionalAccounts` (testée) : filtre les
comptes de type `PRO` d'une liste de `BankAccount`. Appliquée uniquement
aux agrégats de **revenu** du foyer — jamais aux dépenses ni au solde
(`currentBalance`/« argent réellement disponible », qui ne dérive pas des
`Income` mais de `BankAccount.initialBalance`, donc hors périmètre de ce
lot), qui restent suivis normalement sur un compte PRO comme sur n'importe
quel autre. Un virement explicite du compte pro vers un compte
personnel/joint (rémunération réellement disponible) crée un vrai `Income`
sur le compte de destination et compte donc normalement — cohérent avec le
garde-fou « jamais compter un transfert deux fois ».

Points d'application : total et moyenne annuels du tableau de bord, revenu
du mois affiché à côté du budget (`expenses.ts` `summary.totalIncome`),
revenu de référence des stress tests, revenu de base des mois à risque,
revenu utilisé par le taux d'effort et le reste à vivre réel, revenu
récurrent du cockpit dette, records personnels/streak d'épargne (taux
d'épargne dérivé du revenu), et parts du mode `PRORATA_REVENUS` de la
répartition des charges (sinon un membre indépendant paierait une part
disproportionnée calculée sur un chiffre d'affaires qui n'est pas sa
rémunération réelle). Délibérément **non filtré** : les écrans de saisie
et de consultation bruts des revenus (`incomes.ts` — liste, résumé annuel,
revenus variables), où l'utilisateur doit continuer à voir/gérer tout ce
qu'il a logué, y compris sur son compte pro ; et le rapprochement bancaire
d'un compte (`bankAccounts.ts`), qui doit inclure le propre revenu du
compte qu'il réconcilie.

Volontairement hors périmètre (la spec le distingue explicitement comme
un chantier séparé, section 63) : la distinction fine chiffre
d'affaires/TVA/charges/rémunération réellement disponible à l'intérieur
même d'un compte pro — ce lot ne fait que garantir que ce compte n'entre
pas *automatiquement* dans le revenu du foyer, pas une comptabilité pro
complète.

Vérifié en local avec un compte PRO de test : un revenu de 5 000 €
logué dessus laisse inchangés le total annuel du tableau de bord (6 400 €)
et le revenu du mois affiché (3 200 €), tout en restant visible dans la
liste brute des revenus (pour gestion) et dans le revenu de référence des
stress tests (533,33 €/mois, inchangé) — nettoyage confirmé après coup.

### x. Comparaison bancaire (section 49) — comblé par Lot 38

Tentative initiale abandonnée : le sweep hebdomadaire (section 55) semblait
un bon candidat suivant, mais `Expense` n'a qu'une granularité année/mois
(pas de date précise) — impossible de savoir de façon fiable quelle
dépense appartient à quelle semaine calendaire sans inventer une fausse
précision à partir de `createdAt` (date de saisie dans l'app, pas date
réelle de la dépense). Section 55 nécessite d'abord la section 65
(« Dates » : date opération/comptable/débit), un chantier séparé plus
large. Migration et fichiers de ce premier essai entièrement retirés avant
de choisir la section 49 à la place.

Nouveau modèle `FinancingOffer` : une offre nommée (« Banque A »,
« Banque B »...) garde ses propres hypothèses (taux, durée, assurance,
frais), exactement comme l'exige la spec (« Chaque offre conserve ses
propres hypothèses »). Les résultats (mensualité, TAEG, coût total) ne
sont jamais stockés : ils sont recalculés à la lecture par
`simulateFinancing`, la même fonction pure que le simulateur ponctuel du
Lot 30 — pour ne jamais diverger d'une formule corrigée plus tard (même
doctrine que les projections de prêts, section 35). `interestRatePercent`/
`insuranceMonthly`/`fees` sont nullable et distinguent « non renseigné »
(garde-fou section 78, jamais de fausse précision) de « explicitement
zéro », exactement comme le simulateur d'origine.

Routes `GET/POST /api/financing-offers` et `DELETE /api/financing-offers/:id`.
Frontend (`Projection.tsx`) : à côté du simulateur existant, un champ nom +
bouton « Ajouter à la comparaison » qui sauvegarde la simulation en cours,
puis un tableau (Offre/Taux/Durée/Mensualité/TAEG/Coût) reprenant le format
exact de la spec.

Vérifié en local : une offre avec taux connu (3,5 %) et une offre sans taux
(TAEG explicitement « non disponible », jamais un chiffre inventé) créées
côte à côte, chacune affichant ses propres résultats indépendamment —
nettoyage confirmé après coup.

### y. Mensualité soutenable + Capacité immobilière (sections 46-47) — comblé par Lot 39

Section 46 donne des seuils littéraux (Confortable ≤ 300 €, Intermédiaire
300-450 €, Tendu 450-550 €, Très contraint > 550 €) appliqués tels quels à
la mensualité totale (crédit + assurance) — jamais dérivés du taux
d'effort (% du revenu), pour que 300 € signifie la même chose pour tous
les foyers, conformément à la phrase de la spec « les seuils sont issus du
profil financier réel, pas uniquement du taux d'effort ». Nouvelle
fonction pure `classifySustainableMonthlyPayment`, ajoutée aux réponses
existantes `POST /simulate`, `POST /effort-rate` (Lots 30-32) et aux
offres du Lot 38 (`sustainableZone`) — sans nouvelle route pour cette
partie.

Section 47 : plutôt qu'un chiffre unique (« Capacité = 276 483 € »,
explicitement proscrit par la spec), une fourchette par zone. Nouvelle
fonction pure `computePurchaseCapacityRanges` qui **inverse** la formule
d'amortissement de `simulateFinancing` (Lot 30) : à taux/durée/assurance
fixés, la mensualité de crédit est directement proportionnelle au capital
financé, donc chaque borne de zone (300 €, 450 €, 550 €) se retraduit en
un montant total empruntable (financement + apport). Arrondi au millier
d'euros pour ne jamais afficher une fausse précision du type
« 230 483,27 € ». Testé par cohérence croisée avec `simulateFinancing` :
le montant retenu en borne haute d'une zone reproduit bien la mensualité
cible de cette zone. Nouvelle route `POST /api/financing-simulations/capacity`
(taux/durée/assurance/apport, sans montant — c'est justement l'inconnue
qu'on cherche).

Frontend (`Projection.tsx`) : badge de zone coloré (vert/ambre/orange/rouge)
à côté de la mensualité du simulateur et sur chaque ligne de la comparaison
bancaire, plus une nouvelle carte « Capacité immobilière » listant les 4
fourchettes calculées en même temps que la simulation.

Vérifié en local : à 3,5 %, 240 mois, 40 €/mois d'assurance et 15 000 €
d'apport, la zone Confortable va de 15 000 € à 60 000 € et la zone Très
contraint démarre à 103 000 € — un achat de 220 000 € à ces conditions
tombe bien dans Très contraint (mensualité totale 1 228,92 €), cohérent
avec les deux calculs vérifiés indépendamment.

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
