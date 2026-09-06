# Atlas Invest — Spécifications consolidées V2

> Document de référence produit pour Atlas Invest. Objectif : figer la vision
> fonctionnelle et la doctrine de développement pour éviter les dérives, et
> servir de référence stable pour tout travail avec Claude Code.
>
> Ce document décrit la vision cible. Il ne décrit pas nécessairement l'état
> actuel du code — voir la section 76 (ordre de développement) et la section
> 77 (doctrine Claude Code) pour la méthode de mise en œuvre, lot par lot.

## 1. Vision produit

Atlas Invest est une application financière privée destinée à un foyer, avec trois objectifs principaux :

1. Piloter les finances quotidiennes : revenus, dépenses, comptes, échéances et budget.
2. Comprendre le fonctionnement de l'argent du foyer : ce qui est consommé, ce qui est affecté, ce qui est épargné et ce qui construit réellement le patrimoine.
3. Améliorer progressivement la situation financière du foyer : augmenter l'épargne, sécuriser le foyer, financer des projets, piloter les crédits et construire le patrimoine.

Atlas ne doit pas être un simple tracker de dépenses.

Le fil conducteur du produit est :

**PRÉVOIR → DÉPENSER → COMPARER → CORRIGER → ÉPARGNER → CONSTRUIRE → FINANCER**

La couche comportementale ajoute : **MOTIVER**

La philosophie centrale est :

> Atlas doit simplifier l'utilisation de la finance, pas simplifier la finance elle-même.

Les calculs derrière peuvent être sophistiqués. L'interface quotidienne doit rester simple.

## 2. Doctrine financière d'Atlas

Trois notions deviennent structurantes dans toute l'application.

### Argent disponible

Argent qui peut encore réellement être utilisé.

Formule conceptuelle :

```
Soldes disponibles
− engagements connus
− dépenses essentielles restantes estimées
− provisions
− épargne programmée
= argent réellement disponible
```

Atlas doit toujours distinguer les montants : certains, estimés, projetés.

### Argent affecté

Argent encore détenu par le foyer mais déjà réservé à quelque chose.

Exemples : épargne de précaution, vacances, apport immobilier, assurance annuelle, entretien voiture, travaux, impôts, autres projets.

Un euro affecté ne doit pas être présenté comme librement disponible.

### Argent construit

Montants qui participent directement à la progression patrimoniale : épargne, investissement, remboursement de capital d'un crédit.

À distinguer des gains ou pertes de valorisation non réalisés.

Atlas doit pouvoir dire :

> Ce mois-ci : 3 000 € gagnés, 1 750 € consommés, 900 € construits, 350 € encore disponibles.

## 3. Principes UX

L'application doit respecter plusieurs règles permanentes.

**Conclusion avant détail.** L'interface répond d'abord « Où j'en suis ? » puis seulement « Pourquoi ? ».

> 487 € réellement disponibles
> *Voir le calcul*

... et non cinq chiffres avant de donner le résultat.

**Concept avant jargon.**

> 34 € sur 100 € gagnés servent à rembourser tes crédits.
> *(secondaire : Taux d'effort : 34 %)*

**Complexité progressive.** Vue principale simple. Les détails techniques apparaissent en ouvrant : Voir le détail / Comprendre / Modifier / Options avancées.

**La saisie quotidienne doit être ultra-rapide.**

> `courses 42` → Atlas propose : 42 € · Courses · Besoin · Compte joint → Ajouter

Le backend peut stocker beaucoup plus d'informations que ce qui est affiché.

## 4. Navigation principale

Navigation mobile cible :

**Accueil — Mon mois — Mon plan — Projets — Patrimoine — Plus**

Selon contraintes mobiles, Patrimoine peut éventuellement rester dans Plus.

**Plus**

- Gestion : Comptes, Revenus, Transferts, Abonnements, Échéances, Imports
- Finance : Mes prêts, Financements, Historique, Rapports
- Foyer : Répartition des charges, Confidentialité, Utilisateurs
- Paramètres : Profil, Sécurité, Export, Réglages

## 5. Accueil — cockpit financier

Question : **Où en sommes-nous ?**

Information dominante : **Argent réellement disponible**

> 487 € — après les prélèvements, dépenses essentielles restantes et sommes déjà affectées.
> *Voir le calcul*

Détail éventuel :

| Élément | Montant |
|---|---|
| Solde disponible | 2 820 € |
| Échéances restantes | -780 € |
| Dépenses essentielles estimées | -753 € |
| Épargne programmée | -600 € |
| Provisions | -200 € |
| **Disponible** | **487 €** |

L'interface doit signaler la part estimée.

**Résumé budget** — barres Besoins / Envies / Épargne, réel vs prévu.

**Bloc « À faire »** — maximum 3 actions. Exemples : « 3 transactions à catégoriser », « 46 € de surplus à affecter », « budget courses susceptible d'être dépassé ».

**Résumé patrimoine** — Patrimoine net : 42 800 € (+620 € ce mois).

**Résumé financement** (à terme) — Score de financement Atlas : 742/1000 · Bon. Endettement : 24,7 %. Lien vers le cockpit financement.

## 6. Mon mois

Question : **Est-ce que nous respectons notre plan ?**

Tableau principal :

| | Budget type | Budget du mois | Réel | Projection | Écart projeté |
|---|---|---|---|---|---|
| Besoins | | | | | |
| Envies | | | | | |
| Épargne | | | | | |
| Investissement | | | | | |

Le Budget type est la référence habituelle. Le Budget du mois peut être modifié pour tenir compte d'un mois particulier.

**Projection.** Ne doit pas simplement recopier le réel.

```
Réel à date
+ échéances futures connues
+ récurrences attendues
+ dépenses variables estimées
= projection fin de mois
```

Atlas doit indiquer que cette valeur est estimée.

## 7. Budget normal et mois exceptionnel

Un mois peut être marqué **Normal** ou **Exceptionnel**.

Motif éventuel : vacances, mariage, travaux, déménagement, gros achat, rentrée, autre.

Les dépenses exceptionnelles ne doivent pas automatiquement modifier les moyennes du train de vie habituel.

## 8. Ajout de transaction

Mode rapide : montant / texte libre.

> `carrefour 74,20`

Atlas préremplit : montant, marchand, catégorie, nature, compte, caractère personnel/commun. L'utilisateur confirme ou modifie.

**Données internes possibles** sur une transaction : utilisateur, foyer, compte, date transaction, date bancaire, mois budgétaire, marchand, montant, catégorie, sous-catégorie, nature du flux, besoin/envie, fixe/variable/ponctuel, récurrent/non récurrent, personnel/commun, satisfaction, note, source, statut de rapprochement.

## 9. Nature des flux

Atlas doit distinguer au minimum :

- **Revenus** : revenus récurrents, revenus exceptionnels, remboursements, autres entrées.
- **Sorties** : consommation, épargne, investissement, remboursement de capital, intérêts, assurance de crédit, frais financiers.
- **Transferts** : compte personnel → livret, compte personnel → compte joint, livret → compte courant, autres transferts internes.

Un transfert interne ne doit jamais gonfler artificiellement revenus ou dépenses.

## 10. Splits de transaction

Une transaction peut être découpée.

- 100 € → 60 € commun / 40 € personnel
- 100 € → 80 € besoin / 20 € envie
- Échéance bancaire 1 200 € → 730 € remboursement de capital / 410 € intérêts / 60 € assurance

Le modèle de données doit supporter ces cas.

## 11. Dépenses discrétionnaires

Suppression du concept de « dépense inutile ». L'utilisateur peut renseigner :

😊 Ça valait le coup · 😐 Neutre · 😬 Je regrette

Atlas peut ensuite afficher : « 74 € de dépenses regrettées ce mois-ci. » À terme : « Restaurants : 31 % des dépenses marquées "regret". » Aucun jugement automatique.

## 12. Fuites financières

Concept distinct. Une fuite est une dépense qui semble produire peu ou pas de valeur intentionnelle.

Exemples : abonnement oublié, frais bancaire, doublon, hausse de prix, service inutilisé, récurrence suspecte.

> Fuites potentielles : 26 €/mois · 312 €/an

Le mot « potentielles » est important tant que l'utilisateur n'a pas confirmé.

## 13. Annualisation

Les dépenses récurrentes doivent pouvoir être exprimées : 14,99 €/mois → 179,88 €/an.

Les montants agrégés peuvent être arrondis sans centimes lorsque cela améliore la lisibilité.

## 14. Import bancaire

Processus :

> 43 transactions détectées — 36 reconnues, 5 à confirmer, 2 inconnues

L'utilisateur valide. Une validation peut créer une règle : « Toujours classer FREE MOBILE dans Télécom ? »

Les règles de catégorisation doivent pouvoir être modifiées, supprimées, réappliquées, testées avant application massive.

**Anti-doublon.** Chaque import doit utiliser un système de fingerprint basé notamment sur : compte, date, montant, libellé, référence éventuelle. Réimporter le même fichier ne doit pas doubler les transactions.

## 15. Mon plan

Question : **À quoi devrait ressembler un mois normal ?**

L'écran doit présenter en priorité :

```
Revenus habituels
− Charges essentielles
− Envies / loisirs
− Épargne prévue
= Marge libre
```

Puis seulement le détail.

## 16. Méthodes budgétaires

Préréglages possibles : 50/30/20, 60/25/15, 70/20/10, 80/20, base zéro, budget en trois cascades, personnalisé.

Atlas doit surtout montrer les conséquences :

| Scénario | Besoins | Envies | Épargne | Épargne annuelle |
|---|---|---|---|---|
| Confortable | 50 % | 30 % | 20 % | 7 200 € |
| Accélération | 45 % | 25 % | 30 % | 10 800 € |
| Projet prioritaire | 45 % | 15 % | 40 % | 14 400 € |

## 17. Provisions

Les dépenses importantes mais prévisibles doivent être mensualisées.

> Assurance annuelle : 720 € → Provision recommandée : 60 €/mois

Exemples : assurance, taxe foncière, vacances, Noël, entretien voiture, travaux, frais scolaires, impôts, autres dépenses annuelles.

Ces montants entrent dans l'argent affecté.

## 18. Enveloppes virtuelles

Possibilité de réserver une partie du cash sans déplacement bancaire réel.

> Solde Livret A : 8 000 € dont sécurité 4 000 €, voyage 1 500 €, voiture 1 000 €, libre 1 500 €.

Le total des enveloppes ne doit jamais dépasser le solde réellement disponible.

## 19. Projets et objectifs

Chaque objectif contient : nom, cible, montant actuel, date cible facultative, mensualité prévue, priorité, individuel/commun, contributions par utilisateur.

Atlas calcule :

> Objectif : 5 000 € — Déjà épargné : 600 € — Date cible : juin 2028 — 220 €/mois nécessaires

Comparaison : rythme prévu vs rythme réellement observé.

## 20. Priorité des objectifs

Les objectifs peuvent être classés (ex. 1. Sécurité, 2. Résidence principale, 3. Voyage, 4. Investissement). Atlas peut proposer des affectations selon cette priorité.

## 21. Règles d'affectation

> Surplus mensuel : 60 % apport immobilier, 20 % investissement, 20 % loisirs.

Ou : « Tout montant disponible supérieur à 500 € est proposé pour l'objectif Apport. »

Atlas propose la décision ; il n'a pas besoin d'exécuter automatiquement un virement bancaire.

## 22. Épargne de précaution

Questionnaire court, 6 à 8 questions : stabilité des revenus, nombre de revenus du foyer, personnes à charge, charges incompressibles, disponibilité d'autres liquidités, autres facteurs pertinents.

Chaque question indique pourquoi elle est posée.

> Dépenses essentielles : 1 100 €/mois — Sécurité recommandée : 4 mois — Objectif : 4 400 €
> Épargne actuelle : 3 000 € → 2,7 mois de sécurité

Le calcul doit toujours rester visible.

## 23. Répartition des charges du foyer

Possibilités : 50/50, proportionnelle aux revenus, clé personnalisée, poste par poste.

Il faut distinguer **« Qui paie ? »** de **« À qui appartient économiquement la dépense ? »**

> Lisa paie 100 € de courses communes. Répartition 50/50. Atlas sait que : Lisa a payé 100 € ; sa charge économique est 50 € ; Nicolas lui doit 50 €.

## 24. Vue foyer

Elle ne doit pas être une simple somme. Afficher : revenus Nicolas, revenus conjointe, revenus communs, dépenses personnelles, dépenses communes, contribution de chacun, épargne individuelle, épargne commune.

Atlas peut comparer la contribution réelle à la règle retenue.

## 25. Confidentialité

Chaque utilisateur peut choisir : **Détail partagé** ou **Totaux uniquement**.

Le backend doit appliquer cette permission. Les transactions privées ne doivent jamais être envoyées à l'autre utilisateur si seul le total est partagé.

## 26. Comptes

Types : compte courant, livret, compte pro, investissement, espèces éventuelles, autres.

Le compte joint appartient directement au foyer. Il ne doit jamais être comptabilisé deux fois.

## 27. Échéances récurrentes

Chaque échéance peut contenir : libellé, montant, compte, date, fréquence, catégorie, caractère variable/fixe.

Exemples : loyer, crédit, assurance, téléphone, impôts, abonnements.

## 28. Calendrier financier

Atlas affiche les flux futurs par date : revenus, prélèvements, crédits, provisions, grosses dépenses. Il calcule également un solde prévisionnel.

> Le 23 septembre, le compte joint pourrait tomber à 84 €.

Possibilité de définir : Solde minimum souhaité : 300 €.

## 29. Mois à risque

Atlas peut regarder les mois futurs.

> Novembre sera probablement tendu — Revenus attendus : 3 000 € — Charges prévues : 4 100 € — Il faudrait provisionner environ 280 €/mois jusque-là.

## 30. Patrimoine

**Actifs** : liquidités, livrets, placements, immobilier, véhicules éventuellement, autres actifs.

**Passifs** : prêt immobilier, prêt consommation, prêt auto, autre dette.

**KPI** : Patrimoine brut, Dettes, Patrimoine net, Patrimoine liquide.

## 31. Variation du patrimoine

Atlas doit expliquer la progression.

> Patrimoine : +820 € ce mois
> Épargne : +300 € · Investissement : +200 € · Capital immobilier remboursé : +250 € · Performance placements : +70 €

La performance des placements doit être distinguée des flux apportés.

## 32. Valorisation

Chaque actif doit préciser : valeur, date, source, nature de la valeur (saisie manuelle, prix de marché, estimation, prix historique). Éviter la fausse précision.

## 33. Mes prêts

Module dédié aux prêts existants. Chaque prêt contient notamment : type, banque, emprunteur(s), capital initial, capital restant dû, taux nominal, TAEG si connu, date de début, date de fin, durée, mensualité, assurance, frais, compte prélevé, échéancier éventuel.

## 34. Ventilation des mensualités

Pour les crédits amortissables :

> Mensualité : 1 200 € — Capital : 720 € — Intérêts : 420 € — Assurance : 60 €

Atlas doit interpréter : 480 € consommés / 720 € de dette remboursée. C'est central pour le patrimoine.

## 35. Cockpit dette

Afficher : Dette totale, Capital restant dû, Mensualités cumulées, Intérêts restants estimés, Date de fin des crédits, Part des revenus consacrée aux crédits, Prochaine mensualité libérée.

> Crédit auto : 310 €/mois, fin prévue dans 9 mois. À partir de juin 2027, 310 €/mois seront libérés.

## 36. Remboursement anticipé

Mode simulation : « Et si je rembourse 5 000 € maintenant ? »

Atlas calcule : CRD après remboursement, gain d'intérêts, durée restante, mensualité éventuelle, impact épargne de sécurité, impact score de financement.

## 37. Simulateur de financement

Types : immobilier, consommation, voiture, travaux, autre.

Entrées simples : montant, apport, durée, taux, assurance, frais.

Atlas calcule : mensualité, intérêts, coût total, TAEG estimé si données suffisantes, montant total financé.

## 38. Taux de référence

Taux marché par défaut issu d'une source externe (Eurostat / ECB). Toujours présenté comme « Taux de référence marché » et non comme « votre taux bancaire ». L'utilisateur peut le modifier. Chaque simulation sauvegardée conserve le taux utilisé au moment de la simulation.

## 39. TAEG

Si assurance ou frais obligatoires sont inconnus : « TAEG non disponible. » ou « TAEG estimé. » Ne jamais donner une fausse précision.

## 40. Score de financement Atlas

Score propriétaire, 0 à 1000. Jamais « credit score » ni « score bancaire officiel ».

Disclaimer permanent : *« Estimation indicative basée sur les données financières du foyer et les pratiques usuelles du financement. Ne garantit pas l'accord d'un établissement bancaire. »*

## 41. Composantes du score

Version initiale indicative :

| Pilier | Pondération |
|---|---|
| Endettement & charges | 25 % |
| Gestion financière | 20 % |
| Épargne | 20 % |
| Revenus | 15 % |
| Reste à vivre | 10 % |
| Patrimoine & apport | 10 % |

Pondérations configurables et versionnées.

## 42. Score avant / après projet

- **Score financier personnel** : mesure la situation actuelle.
- **Score de finançabilité du projet** : mesure la situation après simulation d'un nouveau prêt.

> Score actuel : 805 — Avec projet : 734

Atlas explique précisément pourquoi.

## 43. Verdict du simulateur

Atlas ne doit jamais afficher « Banque : OUI » ou « Banque : NON ». Utiliser plutôt : **Confortable / Compatible mais serré / Tendu / Très contraint**.

> Situation tendue — Le taux d'effort reste proche du seuil de référence, mais le projet ferait passer votre épargne de sécurité de 5,2 à 2,3 mois.

## 44. Taux d'effort

Le seuil réglementaire ou de référence doit être configurable.

> Taux d'effort actuel : 24,7 % — Après projet : 34,3 % — Référence Atlas : 35 %

Jamais présenté comme un seuil automatique d'acceptation bancaire.

## 45. Reste à vivre réel

L'un des grands avantages d'Atlas : il connaît le reste à vivre théorique mais aussi le train de vie réellement observé.

> Reste après crédit : 2 600 € — Dépenses habituelles observées : 2 250 € — Marge réelle : 350 €/mois

## 46. Mensualité soutenable

Zones : Confortable (≤ 300 €), Intermédiaire (300–450 €), Tendu (450–550 €), Très contraint (> 550 €).

Les seuils sont issus du profil financier réel, pas uniquement du taux d'effort.

## 47. Capacité immobilière

Atlas doit privilégier une fourchette (ex. Zone confortable : 230–250 k€, Intermédiaire : 250–275 k€, Tendue : 275–300 k€) plutôt qu'un chiffre unique du type « Capacité = 276 483 € ». L'objectif est d'éviter la fausse précision.

## 48. Comparaison de scénarios

Atlas peut comparer : Projet actuel, Plus d'apport, Projet moins cher, Durée différente, Attendre la fin d'un crédit, Augmentation de revenus.

> Projet actuel : zone tendue — +10 000 € d'apport : intermédiaire — attendre 8 mois la fin du prêt auto : confortable.

## 49. Comparaison bancaire

| Offre | Taux | Durée | Mensualité | TAEG | Coût |
|---|---|---|---|---|---|
| Banque A | | | | | |
| Banque B | | | | | |
| Banque C | | | | | |

Chaque offre conserve ses propres hypothèses.

## 50. Gamification

Objectif : augmenter l'épargne du foyer sans créer de compétition toxique entre les deux membres. Le foyer joue contre son propre historique, pas l'un contre l'autre.

## 51. Défi mensuel

> Défi septembre — Épargner 600 € — 362 € / 600 € — 238 € restants
> Stretch goal : 🔥 Bonus : 750 €.

L'avancement se base sur de l'épargne réellement enregistrée.

## 52. Streak

> 4 mois consécutifs avec épargne

Même une petite épargne peut maintenir la série. Afficher également : Record : 7 mois. Éviter les mécaniques punitives.

## 53. Records personnels

Exemples : Record d'épargne : 812 € — Meilleur taux d'épargne : 24 % — Meilleur mois de dépenses regrettées : 0 €.

Le foyer cherche à battre ses propres performances.

## 54. Euros sauvés

L'utilisateur peut enregistrer une dépense volontairement évitée : « Je n'ai finalement pas commandé pour 32 €. »

Atlas affiche : 32 € sauvés, puis propose : objectif / sécurité / investissement / garder disponible.

Une économie volontaire n'est considérée comme épargne réelle que lorsqu'elle est effectivement affectée ou enregistrée comme telle.

## 55. Sweep hebdomadaire

> Chaque semaine : Vous avez terminé la semaine 46 € mieux que prévu. Que souhaitez-vous faire ? → Affecter 46 € / Garder disponible

C'est une mécanique prioritaire pour empêcher les petits surplus d'être consommés ultérieurement.

## 56. Défis hebdomadaires

Un seul à la fois. Exemples : restaurants ≤ 60 €, trouver 20 € d'économie récurrente, semaine sans dépense regrettée. Éviter les défis extrêmes type « zéro dépense ».

## 57. Récompense contrôlée

Le foyer peut choisir une règle : « 10 % du dépassement de l'objectif mensuel devient budget plaisir. »

> Objectif : 600 € — Réel : 800 € — Dépassement : 200 € → 20 € plaisir, 180 € épargne supplémentaire.

## 58. Niveaux financiers — phase ultérieure

Les niveaux doivent correspondre à de vrais progrès :

1. **À flot** — budget équilibré.
2. **Tampon** — 1 mois de sécurité.
3. **Protégé** — 3 mois.
4. **Solide** — 6 mois.
5. **Bâtisseur** — construction patrimoniale régulière.

Pas d'XP fictive nécessaire.

## 59. Simulation « Et si ? »

Bac à sable financier. Exemples : « Et si le salaire augmente de 300 € ? », « Et si le loyer augmente de 150 € ? », « Et si nous prenons un crédit auto ? », « Et si nous achetons un logement ? », « Et si nous avons 500 € de charges supplémentaires ? »

Atlas montre avant/après sans modifier les données réelles.

## 60. Stress tests

Exemples : perte d'un revenu pendant 3 mois, baisse de revenu de 30 %, dépense imprévue de 2 500 €, hausse importante du logement.

> Le foyer pourrait absorber ce choc pendant environ X mois.

## 61. Coût complet d'une décision

**Exemple voiture** : Crédit 280 €/mois + Assurance 70 € + carburant 140 € + entretien provisionné 50 € = Coût réel : 540 €/mois.

**Exemple immobilier** : mensualité + assurance + copropriété + taxe foncière + entretien.

## 62. Revenus

Distinguer : récurrent, variable, exceptionnel, remboursement, professionnel.

Le budget type doit utiliser un revenu structurel raisonnable et non une prime exceptionnelle.

Pour des revenus variables, Atlas pourra plus tard calculer : revenu moyen et revenu prudent.

## 63. Cas professionnel

Un compte professionnel ne doit pas automatiquement entrer dans le revenu du foyer. Distinguer : chiffre d'affaires, TVA, charges, rémunération réellement disponible, remboursements professionnels.

## 64. Paiements particuliers

Le modèle doit anticiper : espèces, chèques, carte à débit différé, paiements fractionnés, cashback, remboursement mutuelle, remboursement d'un proche, dépenses partagées hors foyer.

## 65. Dates

Une transaction peut avoir : date opération, date comptable, date de débit, mois budgétaire. Important notamment pour les cartes à débit différé.

## 66. Historique et audit

Toute modification importante doit être historisée. Exemples : budget courses passé de 350 à 400 €, objectif passé de 5 000 à 10 000 €, transaction recatégorisée, prêt modifié.

Les suppressions importantes doivent privilégier l'archivage / soft delete plutôt qu'une suppression immédiate.

## 67. Provenance des données

Chaque valeur importante doit pouvoir être qualifiée : Saisie manuelle, Importée, Calculée, Estimée, Source externe.

Cela améliore énormément la confiance.

## 68. Contrôles de cohérence

Atlas doit disposer de contrôles automatiques.

> Solde initial + revenus − dépenses ± transferts = solde attendu.

Si le rapprochement échoue : ⚠️ Écart de rapprochement : 82,43 €. Ne jamais cacher silencieusement les incohérences.

## 69. Versionnement des moteurs

Tous les calculs importants doivent être versionnés : `precaution_v1`, `financing_score_v1`, `projection_v1`, etc. Une évolution d'algorithme ne doit pas rendre l'historique incompréhensible.

## 70. Sécurité

Puisque les données sont sensibles : authentification sécurisée, hash de mot de passe robuste, sessions sécurisées, 2FA TOTP, codes de récupération, rate limiting, récupération mot de passe, journal de connexion, sauvegardes, TLS, protection des secrets, contrôle des permissions côté backend.

Pour une application de ce type, privilégier les sessions serveur et cookies sécurisés plutôt que des JWT stockés dans le navigateur.

## 71. Exports

Prévoir : CSV, JSON, rapport mensuel PDF. Le JSON doit permettre une vraie sauvegarde/reconstitution des données.

## 72. Rapport mensuel

Contenu : Revenus, Dépenses, Budget vs réel, Épargne, Euros sauvés, Fuites détectées, Objectifs, Patrimoine, Crédits, Actions proposées.

## 73. Design

Direction actuelle retenue : **Fintech premium chaleureuse**.

Palette envisageable : ivoire, crème, sable, cuivre / terracotta, brun foncé.

Couleurs fonctionnelles : vert = positif, orange = vigilance, rouge = problème, violet éventuellement réservé épargne/investissement/patrimoine.

**Règles visuelles** : réduire fortement les emojis, une bibliothèque d'icônes unique, moins de cartes, gros chiffres hiérarchisés, centimes uniquement lorsque pertinents, graphiques utilisés lorsque réellement utiles, détails dépliables, mobile plus synthétique que desktop.

> Note d'implémentation (2026-09) : la palette « Boutique » actuellement en place (crème `#f7efe4`, cuivre `#b5652d`, terracotta `#a8442b`, olive `#55702f`, typographie Sora + Work Sans) correspond déjà à cette direction. Le violet reste à réserver spécifiquement à épargne/investissement/patrimoine si une distinction visuelle supplémentaire s'avère utile — actuellement le violet a été retiré au profit du trio cuivre/terracotta/olive pour Besoins/Envies/Épargne.

## 74. Modèle de données cible — grandes entités

Prévoir au minimum : `User`, `Household`, `Account`, `Transaction`, `TransactionSplit`, `Transfer`, `Income`, `BudgetPlan`, `MonthlyBudget`, `Category`, `CategorizationRule`, `RecurringPayment`, `Subscription`, `Provision`, `VirtualEnvelope`, `SavingsGoal`, `GoalContribution`, `HouseholdSharingRule`, `Asset`, `AssetValuation`, `Liability`, `Loan`, `LoanPayment`, `LoanSchedule`, `FinancingProject`, `FinancingScenario`, `FinancingOffer`, `MarketRate`, `FinancingScore`, `Challenge`, `SavedEuroEvent`, `AuditLog`, `ImportBatch`, `ImportTransaction`.

## 75. Quelques relations importantes

- **Transaction** appartient à `Account`, et éventuellement `User` ou `Household`. Peut avoir plusieurs `TransactionSplit`.
- **Loan** rattaché à un ou plusieurs utilisateurs, éventuellement un actif, un compte prélevé.
- **FinancingProject** peut contenir plusieurs `FinancingScenario` et plusieurs `FinancingOffer`.
- **SavingsGoal** peut être individuel ou foyer, avec plusieurs `GoalContribution`.

## 76. Ordre de développement recommandé

**Phase 0 — Audit et stabilisation** : corriger revenu annuel/mensuel, cartographier le modèle actuel, écrire des tests de calcul, identifier les données existantes à migrer.

**Phase 1 — Moteur financier** : comptes, revenus, transactions, types de flux, transferts, splits, budget type, budget mensuel, contrôles de cohérence.

**Phase 2 — UX fondamentale** : nouvelle navigation, Accueil, Mon mois, Mon plan, argent réellement disponible, projections, design system.

**Phase 3 — Anticipation** : échéances, récurrences, provisions, enveloppes, calendrier, mois à risque.

**Phase 4 — Épargne** : sécurité, objectifs, priorités, règles d'affectation, partage foyer.

**Phase 5 — Gamification** : défi mensuel, streak, records, euros sauvés, sweep hebdomadaire, défis courts.

**Phase 6 — Patrimoine** : actifs, passifs, patrimoine net, patrimoine liquide, historique, variation du patrimoine.

**Phase 7 — Prêts existants** : Mes prêts, CRD, échéancier, capital/intérêts, coût, extinction, remboursement anticipé.

**Phase 8 — Financement** : simulateur, taux marché, capacité, score Atlas, score après projet, comparaison scénarios, comparaison banques.

**Phase 9 — Intelligence avancée** : fuites, tendances, inflation personnelle, détection comportementale, stress tests, scénarios avancés.

## 77. Doctrine Claude Code

Ne jamais donner : « Construis Atlas V2 avec cette spec. »

Il doit travailler **lot par lot**. Chaque lot doit comporter :

- Objectif
- Périmètre
- Ce qui ne doit pas être modifié
- Modèle de données impacté
- Règles de calcul
- Cas limites
- Tests attendus
- Critères d'acceptation

Exemple :

> **Lot 1 — Correction revenus**
> Corriger exclusivement la confusion entre revenus annuels et mensuels. Aucun changement UI supplémentaire. Identifier toutes les fonctions utilisant revenu annuel, mensuel et moyen. Ajouter tests. Ne modifier aucune autre fonctionnalité.

Puis validation avant Lot 2.

## 78. Les principaux garde-fous

Atlas ne doit jamais :

- compter deux fois un transfert ;
- traiter toute mensualité de crédit comme une consommation ;
- présenter une estimation comme une donnée certaine ;
- présenter un score Atlas comme un score bancaire officiel ;
- présenter le seuil HCSF comme une garantie ;
- donner un TAEG faussement précis ;
- modifier automatiquement un budget historique ;
- cacher un écart de rapprochement ;
- recommander de vider l'épargne de sécurité pour maximiser un apport ;
- transformer la gamification en culpabilisation ;
- considérer toute réduction de dépense comme souhaitable ;
- produire des projections précises sans afficher leurs hypothèses.

## 79. La boucle produit finale

La colonne vertébrale d'Atlas :

```
Je gagne
  ↓
Atlas identifie ce qui est déjà engagé
  ↓
Je sais ce qui est réellement disponible
  ↓
Je dépense simplement
  ↓
Atlas compare au plan et projette la fin du mois
  ↓
Le surplus est identifié
  ↓
Je l'affecte à la sécurité ou à mes projets
  ↓
Atlas transforme l'épargne et le remboursement de dette en patrimoine
  ↓
Je peux simuler de nouveaux projets et crédits
  ↓
Atlas mesure leur impact sur ma situation réelle
  ↓
La gamification m'incite à améliorer progressivement cette trajectoire.
```

**Positionnement final.** Atlas Invest est le cockpit financier du foyer : il permet de comprendre ce que devient l'argent, d'anticiper les décisions, d'économiser davantage et de mesurer la construction réelle du patrimoine.
