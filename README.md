# Bien-être Dashboard

## 1. Présentation du projet

Bien-être Dashboard est un outil métier conçu pour une praticienne en médecine chinoise / bien-être.

L'application permet de suivre les rendez-vous et les paiements associés. Les rendez-vous viennent d'un agenda Google Calendar existant, lu via une URL iCal privée côté serveur.

L'application ne crée, ne modifie et ne supprime aucun rendez-vous Google Calendar. Elle ajoute une couche métier au-dessus de l'agenda : suivi des paiements, modification/suppression des paiements enregistrés, et export CSV.

## 2. Fonctionnalités actuelles

- Lecture des rendez-vous Google Calendar via iCal, serveur uniquement.
- Dashboard protégé par authentification admin.
- Affichage des rendez-vous dans une interface responsive mobile-first.
- Tri des rendez-vous :
  - paiements à renseigner en haut ;
  - paiements enregistrés en bas.
- Filtrage des rendez-vous affichés :
  - tous les rendez-vous passés ;
  - plus les 7 prochains jours glissants.
- Modal de paiement :
  - choix de prestation ;
  - montant prérempli selon la prestation ;
  - montant modifiable manuellement ;
  - modification possible d'un paiement existant.
- Prestations disponibles :
  - Première séance — 75 euros ;
  - Séance d'entretien — 60 euros.
- Suppression d'un paiement sans supprimer le rendez-vous Google Calendar.
- Export CSV compatible Excel / LibreOffice :
  - BOM UTF-8 ;
  - séparateur `;`.
- Authentification admin simple :
  - un seul compte ;
  - mot de passe hashé avec bcrypt ;
  - session signée via cookie `httpOnly`.
- Protection des routes API sensibles.
- Page d'aide.
- Design moderne, sobre et responsive.

## 3. Stack technique

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL via Docker
- bcryptjs
- jose

## 4. Architecture

Flux principal :

```text
Google Calendar
  -> iCal privé
  -> serveur Next.js
  -> dashboard
  -> API Next.js
  -> Prisma
  -> PostgreSQL
```

Principes importants :

- L'URL iCal est lue uniquement côté serveur.
- Le navigateur ne reçoit jamais l'URL iCal.
- Google Calendar est utilisé en lecture seule.
- Les paiements sont les seules données métier persistées dans PostgreSQL.

## 5. Routes

Pages :

```text
GET /
GET /login
GET /dashboard
GET /help
```

API :

```text
POST   /api/login
POST   /api/logout
GET    /api/payments
POST   /api/payments
DELETE /api/payments/[appointmentUid]
GET    /api/export
```

## 6. Variables d'environnement

Créer un fichier `.env.local` à la racine du projet.

Exemple :

```env
ICAL_SECRET_URL=""
DATABASE_URL="postgresql://bienetre:bienetre_password@localhost:5432/bienetre_dashboard"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH=""
SESSION_SECRET=""
```

### `ICAL_SECRET_URL`

URL iCal privée Google Calendar.

Elle doit rester secrète et côté serveur. Ne jamais la préfixer avec `NEXT_PUBLIC_`.

### `DATABASE_URL`

URL de connexion PostgreSQL utilisée par Prisma.

En développement local :

```env
DATABASE_URL="postgresql://bienetre:bienetre_password@localhost:5432/bienetre_dashboard"
```

En Docker Compose de production, l'hôte sera généralement le nom du service PostgreSQL, par exemple :

```env
DATABASE_URL="postgresql://bienetre:bienetre_password@db:5432/bienetre_dashboard"
```

### `ADMIN_USERNAME`

Nom du compte admin unique.

Exemple :

```env
ADMIN_USERNAME="admin"
```

### `ADMIN_PASSWORD_HASH`

Hash bcrypt du mot de passe admin. Ne jamais stocker le mot de passe en clair.

Générer un hash :

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('mot-de-passe-admin', 12).then(console.log)"
```

Important avec Next.js : les caractères `$` du hash bcrypt doivent être échappés dans `.env.local`.

Exemple :

```env
ADMIN_PASSWORD_HASH="\$2b\$12\$..."
```

### `SESSION_SECRET`

Secret utilisé pour signer les sessions.

Générer une valeur :

```bash
openssl rand -base64 32
```

### Sécurité des fichiers `.env`

- Ne jamais commit `.env.local`.
- Ne jamais commit de vrais secrets.
- `.env.example` doit rester un modèle sans valeur sensible.

## 7. Installation & développement

Installer les dépendances :

```bash
npm install
```

Démarrer PostgreSQL :

```bash
docker compose up -d db
```

Si Docker utilise l'ancienne commande :

```bash
docker-compose up -d db
```

Appliquer la migration Prisma :

```bash
npx prisma migrate dev --name init
```

Démarrer Next.js en développement :

```bash
npm run dev
```

Pages utiles :

```text
http://localhost:3000/
http://localhost:3000/login
http://localhost:3000/dashboard
http://localhost:3000/help
```

Vérifications :

```bash
npm run lint
npm run build
```

## 8. État actuel

Le MVP est terminé et fonctionnel.

Il permet :

- de se connecter en admin ;
- de consulter les rendez-vous Google Calendar importés via iCal ;
- de renseigner, modifier et supprimer des paiements ;
- de visualiser un récapitulatif ;
- d'exporter les paiements en CSV ;
- d'accéder à une page d'aide expliquant le fonctionnement.

## 9. Environnements et déploiement VPS

Le projet supporte trois environnements :

- local sur le PC de développement ;
- dev VPS sur `dev.bienetre.alexsoutienscolaire.fr` ;
- prod VPS sur `bienetre.alexsoutienscolaire.fr`.

Le développement local reste volontairement simple : l'application tourne avec `npm run dev` sur la machine, et Docker ne sert qu'à lancer PostgreSQL. Les environnements VPS utilisent des fichiers Compose dédiés pour éviter les conflits de ports, de conteneurs, de volumes et de réseaux.

### 9.1 Développement local

Le fichier `docker-compose.yml` reste dédié au local et lance uniquement la base PostgreSQL.

```bash
docker compose up -d db
npx prisma migrate dev
npm run dev
```

En local, `DATABASE_URL` pointe vers PostgreSQL exposé sur la machine :

```env
DATABASE_URL="postgresql://bienetre:bienetre_password@localhost:5432/bienetre_dashboard"
```

### 9.2 Image Docker de production

Le `Dockerfile` construit l'application Next.js en mode production :

- installation propre avec `npm ci` ;
- génération Prisma avec `npx prisma generate` ;
- build Next.js avec `npm run build` ;
- démarrage avec `npm run start` ;
- port interne `3000`.

Le fichier `.dockerignore` exclut les dossiers et secrets locaux de l'image Docker.

### 9.3 Variables d'environnement VPS

Sur le VPS, chaque instance possède son propre dossier et son propre fichier `.env`.

Variables attendues :

```env
ICAL_SECRET_URL="https://calendar.google.com/calendar/ical/..."
DATABASE_URL="postgresql://bienetre:bienetre_password@db:5432/bienetre_dashboard"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="\$2b\$12\$..."
SESSION_SECRET="..."
POSTGRES_DB="bienetre_dashboard"
POSTGRES_USER="bienetre"
POSTGRES_PASSWORD="bienetre_password"
```

Important :

- `DATABASE_URL` doit utiliser l'hôte `db` sur le VPS, car PostgreSQL tourne dans le réseau Docker interne ;
- `POSTGRES_DB`, `POSTGRES_USER` et `POSTGRES_PASSWORD` doivent correspondre à `DATABASE_URL` ;
- ne jamais commit de vrais secrets ;
- ne jamais préfixer `ICAL_SECRET_URL` avec `NEXT_PUBLIC_`.

### 9.4 Déploiement dev VPS

Dossier prévu :

```bash
/opt/apps/bienetre-dashboard-dev
```

Préparer l'application :

```bash
sudo mkdir -p /opt/apps/bienetre-dashboard-dev
sudo chown -R $USER:$USER /opt/apps/bienetre-dashboard-dev
cd /opt/apps/bienetre-dashboard-dev
git clone <URL_DU_REPO> .
nano .env
```

Construire et lancer l'instance dev :

```bash
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml exec app npx prisma migrate deploy
```

L'application dev écoute uniquement en local sur le VPS :

```text
127.0.0.1:3006
```

Elle est ensuite publiée par Caddy sur :

```text
dev.bienetre.alexsoutienscolaire.fr
```

### 9.5 Déploiement prod VPS

Dossier prévu :

```bash
/opt/apps/bienetre-dashboard-prod
```

Préparer l'application :

```bash
sudo mkdir -p /opt/apps/bienetre-dashboard-prod
sudo chown -R $USER:$USER /opt/apps/bienetre-dashboard-prod
cd /opt/apps/bienetre-dashboard-prod
git clone <URL_DU_REPO> .
nano .env
```

Construire et lancer l'instance prod :

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

L'application prod écoute uniquement en local sur le VPS :

```text
127.0.0.1:3005
```

Elle est ensuite publiée par Caddy sur :

```text
bienetre.alexsoutienscolaire.fr
```

### 9.6 Caddy

Configuration Caddy :

```caddyfile
dev.bienetre.alexsoutienscolaire.fr {
    reverse_proxy localhost:3006
}

bienetre.alexsoutienscolaire.fr {
    reverse_proxy localhost:3005
}
```

Recharger Caddy :

```bash
sudo systemctl reload caddy
```

Caddy gère automatiquement HTTPS si les DNS pointent vers le VPS et si les ports 80 et 443 sont ouverts.

### 9.7 Séparation dev/prod

Les fichiers VPS sont séparés :

- `docker-compose.dev.yml` pour l'instance dev ;
- `docker-compose.prod.yml` pour l'instance prod.

Chaque instance possède :

- son conteneur app ;
- son conteneur PostgreSQL ;
- son volume PostgreSQL ;
- son réseau Docker ;
- son port applicatif local.

PostgreSQL n'est pas exposé publiquement dans les fichiers VPS. Seule l'application est bindée sur `127.0.0.1`, puis Caddy expose les domaines HTTPS.

### 9.8 Vérifications

Avant de déployer :

```bash
npm run lint
npm run build
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.prod.yml config
```

## 10. Notes importantes

- L'iCal est utilisé en lecture seule.
- Les paiements sont stockés en base PostgreSQL.
- L'URL iCal est secrète et doit rester côté serveur.
- Le projet est conçu pour pouvoir évoluer vers un SaaS.
- Attention aux ports si plusieurs applications Docker tournent sur le VPS.
- L'application ne remplace pas Google Calendar : elle ajoute une couche de suivi métier.
- L'export CSV reflète les paiements enregistrés dans PostgreSQL.
