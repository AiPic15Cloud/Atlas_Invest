# Budget Foyer

Application de suivi budgétaire personnel et familial. Ce dépôt est construit
**section par section** : chaque étape ajoute une brique de la spécification
complète, plutôt que de tout livrer d'un coup.

## Ce qui est construit pour l'instant (le "socle")

- Création de compte et connexion (email / mot de passe)
- Notion de **foyer** : créer un foyer ou en rejoindre un avec un code
  d'invitation
- Plusieurs **comptes bancaires par utilisateur** (courant, livret, pro,
  autre), avec un solde saisi manuellement
- **Compte joint** : rattaché au foyer (pas à une seule personne), visible
  par tous les membres, compté une seule fois dans les totaux
- Réglage de **confidentialité** par utilisateur : partager le détail de ses
  comptes avec le foyer, ou seulement un total consolidé
- Suppression de compte / sortie du foyer

Pas encore construit (prochaines sections, dans l'ordre de la spec) :
revenus, budget type, budget du mois, import de relevé, tableau de bord,
épargne de précaution, 2FA, etc.

## Stack technique

- **Backend** : Node.js + Express + TypeScript, Prisma (ORM), PostgreSQL,
  authentification par JWT, mots de passe hashés avec bcrypt.
- **Frontend** : React + Vite + TypeScript + Tailwind CSS.
- **Hébergement prévu** : Railway (API + frontend + PostgreSQL).

## Lancer le projet en local (guide pas à pas)

Tu n'as pas besoin de connaître le développement pour suivre ces étapes.

### 1. Installer les outils nécessaires (une seule fois)

- [Node.js](https://nodejs.org/) version 20 ou plus (installe la version "LTS")
- [pnpm](https://pnpm.io/installation) : une fois Node installé, ouvre un
  terminal et tape `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) : pour
  faire tourner la base de données PostgreSQL sur ton ordinateur sans
  l'installer directement

### 2. Récupérer le projet

```bash
git clone https://github.com/AiPic15Cloud/github.com-aipic15cloud-budget-foyer.git
cd github.com-aipic15cloud-budget-foyer
pnpm install
```

### 3. Démarrer la base de données

```bash
docker compose up -d
```

Cela lance une base PostgreSQL locale (les données restent sur ton
ordinateur, rien n'est envoyé ailleurs).

### 4. Configurer les variables d'environnement

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Ouvre `apps/api/.env` et remplace la valeur de `JWT_SECRET` par une valeur
aléatoire (tu peux taper `openssl rand -base64 48` dans un terminal pour en
générer une, ou simplement inventer une longue phrase aléatoire).

### 5. Créer les tables dans la base de données

```bash
pnpm prisma:migrate
```

La première fois, cette commande te demandera un nom de migration — tu peux
taper `init` et valider.

### 6. Lancer l'application

Dans deux terminaux séparés :

```bash
pnpm dev:api    # démarre l'API sur http://localhost:3001
```

```bash
pnpm dev:web    # démarre le site sur http://localhost:5173
```

Ouvre ensuite [http://localhost:5173](http://localhost:5173) dans ton
navigateur : tu peux créer un compte, créer ton foyer, et ajouter tes
comptes bancaires.

## Déployer sur Railway (mise en ligne)

Railway va héberger trois éléments : la base de données PostgreSQL, l'API,
et le site web. Tout se fait depuis [railway.app](https://railway.app).

1. **Crée un nouveau projet** sur Railway et connecte ton compte GitHub.
2. **Ajoute une base PostgreSQL** : bouton "New" → "Database" →
   "PostgreSQL". Railway te donnera automatiquement une variable
   `DATABASE_URL`.
3. **Ajoute un service pour l'API** : bouton "New" → "GitHub Repo" → choisis
   ce dépôt. Dans les réglages du service :
   - Build command : `pnpm install --frozen-lockfile && pnpm --filter @budget/api prisma:generate && pnpm --filter @budget/api build`
   - Start command : `pnpm --filter @budget/api prisma:deploy && pnpm --filter @budget/api start`
   - Variables d'environnement : `DATABASE_URL` (référence la base créée à
     l'étape 2 avec `${{Postgres.DATABASE_URL}}`), `JWT_SECRET` (une valeur
     aléatoire, différente de celle du local), `WEB_ORIGIN` (l'URL publique
     du site web, ajoutée après l'étape 4)
4. **Ajoute un second service pour le site web**, à partir du même dépôt :
   - Build command : `pnpm install --frozen-lockfile && pnpm --filter @budget/web build`
   - Start command : `pnpm --filter @budget/web start`
   - Variable d'environnement : `VITE_API_URL` (l'URL publique du service
     API créé à l'étape 3)
5. Génère un domaine public pour chacun des deux services (bouton
   "Generate Domain" dans l'onglet "Settings" de chaque service), puis mets
   à jour `WEB_ORIGIN` et `VITE_API_URL` avec ces URLs et redéploie.

## Structure du dépôt

```
apps/
  api/    API backend (Express, Prisma, routes REST)
  web/    Site frontend (React, Vite)
docker-compose.yml   PostgreSQL pour le développement local
```
