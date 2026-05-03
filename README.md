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

## 9. Déploiement sur VPS

Cette section décrit une mise en production propre sur un VPS avec Docker Compose et Caddy.

Objectif :

- Dockeriser l'application Next.js ;
- faire tourner PostgreSQL dans Docker ;
- exposer uniquement l'application localement sur le VPS ;
- publier le site via Caddy et HTTPS automatique.

### 9.1 Dockeriser l'application Next.js

Créer un fichier `Dockerfile` à la racine du projet :

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "run", "start"]
```

Le conteneur lance l'application en mode production :

```text
next build
next start
```

### 9.2 Docker Compose complet

Le `docker-compose.yml` de production doit contenir au minimum :

- un service `app` pour Next.js ;
- un service `db` pour PostgreSQL ;
- un réseau interne partagé ;
- les variables d'environnement injectées ;
- PostgreSQL non exposé publiquement ;
- l'application exposée seulement en local, par exemple `127.0.0.1:3005:3000`.

Exemple :

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: bienetre-dashboard-app
    restart: unless-stopped
    env_file:
      - .env.local
    ports:
      - "127.0.0.1:3005:3000"
    depends_on:
      - db
    networks:
      - bienetre_network

  db:
    image: postgres:16
    container_name: bienetre-dashboard-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: bienetre_dashboard
      POSTGRES_USER: bienetre
      POSTGRES_PASSWORD: bienetre_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - bienetre_network

volumes:
  postgres_data:

networks:
  bienetre_network:
```

Important :

- ne pas exposer PostgreSQL avec `ports: "5432:5432"` en production ;
- utiliser `DATABASE_URL` avec l'hôte `db` dans `.env.local` :

```env
DATABASE_URL="postgresql://bienetre:bienetre_password@db:5432/bienetre_dashboard"
```

### 9.3 Préparation du VPS

Créer un dossier projet :

```bash
sudo mkdir -p /opt/apps/bienetre-dashboard
sudo chown -R $USER:$USER /opt/apps/bienetre-dashboard
cd /opt/apps/bienetre-dashboard
```

Cloner le repository :

```bash
git clone <URL_DU_REPO> .
```

Créer le fichier `.env.local` :

```bash
nano .env.local
```

Exemple production :

```env
ICAL_SECRET_URL="https://calendar.google.com/calendar/ical/..."
DATABASE_URL="postgresql://bienetre:bienetre_password@db:5432/bienetre_dashboard"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="\$2b\$12\$..."
SESSION_SECRET="..."
```

Attention :

- d'autres applications Docker peuvent déjà tourner sur le VPS ;
- vérifier les ports utilisés avant de choisir `3005` ;
- ne pas exposer publiquement le port de l'application ;
- Caddy fera l'exposition publique via HTTPS.

### 9.4 Lancement sur VPS

Construire et lancer les conteneurs :

```bash
docker compose up -d --build
```

Vérifier que les conteneurs tournent :

```bash
docker compose ps
```

Voir les logs :

```bash
docker compose logs -f app
docker compose logs -f db
```

Appliquer les migrations Prisma en production :

```bash
docker compose exec app npx prisma migrate deploy
```

Tester localement depuis le VPS :

```bash
curl http://127.0.0.1:3005
```

### 9.5 Reverse proxy avec Caddy

Configurer un domaine, par exemple :

```text
bienetre.ton-domaine.fr
```

Exemple de configuration Caddy :

```caddyfile
bienetre.ton-domaine.fr {
    reverse_proxy localhost:3005
}
```

Recharger Caddy :

```bash
sudo systemctl reload caddy
```

Caddy gère automatiquement HTTPS si :

- le domaine pointe vers le VPS ;
- les ports 80 et 443 sont ouverts ;
- Caddy est correctement installé et lancé.

### 9.6 DNS

Chez le registrar ou fournisseur DNS :

- ajouter un enregistrement `A` ;
- nom : `bienetre` ;
- valeur : IP publique du VPS.

Exemple :

```text
bienetre.ton-domaine.fr -> 123.123.123.123
```

Attendre la propagation DNS.

### 9.7 Sécurité minimale

- Accéder à l'application uniquement via Caddy.
- Ne pas exposer PostgreSQL publiquement.
- Ne pas exposer directement le port Docker de l'application sur Internet.
- Garder les secrets uniquement dans `.env.local`.
- Utiliser un `SESSION_SECRET` long et aléatoire.
- Le cookie de session est `httpOnly`.
- En production, le cookie est marqué `secure`.

## 10. Notes importantes

- L'iCal est utilisé en lecture seule.
- Les paiements sont stockés en base PostgreSQL.
- L'URL iCal est secrète et doit rester côté serveur.
- Le projet est conçu pour pouvoir évoluer vers un SaaS.
- Attention aux ports si plusieurs applications Docker tournent sur le VPS.
- L'application ne remplace pas Google Calendar : elle ajoute une couche de suivi métier.
- L'export CSV reflète les paiements enregistrés dans PostgreSQL.
