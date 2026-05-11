# Bien-être Dashboard

## 1. Présentation

Bien-être Dashboard est un outil métier conçu pour Julie, praticienne
bien-être.

L'application contient aujourd'hui deux flux de rendez-vous :

- un flux Calendly historique, utilisé pour le dashboard principal, les
  paiements, les factures PDF et l'export CSV ;
- un flux de réservation interne, utilisé pour gérer des disponibilités,
  recevoir des demandes de rendez-vous, confirmer par email et afficher un
  agenda admin dédié.

Ces deux flux coexistent. La réservation interne ne remplace pas encore
Calendly et n'est pas encore reliée aux paiements, factures ou exports.

## 2. Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Docker Compose
- bcryptjs
- jose
- SMTP maison
- @react-pdf/renderer

## 3. Fonctionnalités existantes

### Calendly, paiements, factures et export

- Lecture des rendez-vous Calendly côté serveur via l'API Calendly.
- Dashboard admin protégé sur `/dashboard`.
- Suivi des paiements associés aux rendez-vous Calendly.
- Création et modification de paiements.
- Suppression d'un paiement sans supprimer le rendez-vous Calendly.
- Factures PDF liées aux paiements.
- Export CSV des paiements.

Calendly est lu en lecture seule. L'application ne crée, ne modifie et ne
supprime aucun rendez-vous Calendly.

### Réservation interne

- Gestion des plages de disponibilité via `/dashboard/disponibilites`.
- Réservation publique via `/reservation`.
- Parcours dédiés :
  - `/reservation/premier-rdv` pour un rendez-vous de 1h30 ;
  - `/reservation/suivi` pour un rendez-vous de 1h.
- Calcul automatique des horaires disponibles.
- Anti-chevauchement côté backend.
- Création de `Booking` en statut `PENDING`.
- Email de confirmation avec token.
- Page publique `/reservation/confirmer`.
- Agenda admin des réservations internes via `/dashboard/reservations`.

### Admin Julie

Julie peut aujourd'hui :

- se connecter à l'admin ;
- consulter le dashboard Calendly historique ;
- saisir et modifier des paiements Calendly ;
- générer des factures liées aux paiements ;
- exporter les paiements en CSV ;
- ouvrir ou supprimer des plages de disponibilité ;
- copier une semaine de disponibilités vers la suivante, avec blocage si la
  semaine suivante contient déjà des disponibilités ;
- consulter les réservations internes dans un agenda hebdomadaire ;
- voir les disponibilités en fond dans l'agenda des réservations ;
- confirmer manuellement une demande ;
- marquer une réservation comme annulée.

## 4. Routes principales

Pages publiques :

```text
GET /
GET /login
GET /reservation
GET /reservation/premier-rdv
GET /reservation/suivi
GET /reservation/confirmer
```

Pages admin protégées :

```text
GET /dashboard
GET /dashboard/disponibilites
GET /dashboard/reservations
GET /dashboard/export
GET /dashboard/payments/[paymentId]/invoice
GET /help
```

API :

```text
POST   /api/login
POST   /api/logout

GET    /api/payments
POST   /api/payments
DELETE /api/payments/[appointmentUid]

GET    /api/payments/[appointmentUid]/invoice
POST   /api/payments/[appointmentUid]/invoice
GET    /api/payments/[appointmentUid]/invoice/pdf
GET    /api/invoices/next-number

GET    /api/export

GET    /api/availability-slots
POST   /api/availability-slots
DELETE /api/availability-slots/[slotId]

GET    /api/bookings
POST   /api/bookings
PATCH  /api/bookings/[bookingId]
```

`POST /api/bookings` est public car il sert au formulaire de réservation.
`GET /api/bookings` et `PATCH /api/bookings/[bookingId]` sont protégés.

## 5. Modèles Prisma

Le schéma se trouve dans `prisma/schema.prisma`.

### `Payment`

Représente la couche paiement/comptabilité historique.

Il est encore lié au flux Calendly via :

- `appointmentUid`
- `calendlyEventUri`
- `calendlyInviteeUri`

`appointmentUid` est une clé métier unique construite côté dashboard à partir
du rendez-vous Calendly affiché.

### `Invoice`

Représente une facture liée à un `Payment`.

La relation est :

```text
Payment 1 -> 0..1 Invoice
```

La suppression d'un `Payment` supprime la facture associée via cascade.

### `AvailabilitySlot`

Représente une plage de disponibilité ouverte par Julie.

Champs principaux :

- `startAt`
- `endAt`
- `isActive`
- `notes`

Le champ `capacity` a existé brièvement puis a été supprimé.

### `Booking`

Représente une demande ou réservation interne.

Champs principaux :

- `availabilitySlotId`
- `source`
- `status`
- `clientFirstName`
- `clientLastName`
- `clientName`
- `clientEmail`
- `clientPhone`
- `clientMessage`
- `service`
- `startAt`
- `endAt`
- `confirmationTokenHash`
- `confirmationTokenExpiresAt`
- `confirmedAt`
- `cancelledAt`

Enums :

```text
BookingStatus = PENDING | CONFIRMED | CANCELLED | EXPIRED
BookingSource = INTERNAL | CALENDLY | ADMIN
```

## 6. Calendly

Le code Calendly se trouve dans `src/lib/calendar.ts`.

Il utilise `CALENDLY_TOKEN` côté serveur pour appeler :

- `/users/me`
- `/scheduled_events`
- `/scheduled_events/{uuid}/invitees`

Les événements sont convertis en `CalendarEvent`, puis utilisés par
`/dashboard`.

Calendly alimente encore :

- la liste des rendez-vous du dashboard principal ;
- la saisie des paiements ;
- la création de factures ;
- l'export CSV.

La réservation interne n'est pas encore fusionnée avec Calendly.

## 7. Réservation interne

Les parcours publics sont configurés dans `src/lib/reservation-services.ts`.

Durées :

- premier rendez-vous : 90 minutes ;
- suivi : 60 minutes.

Les données nécessaires aux pages de réservation sont préparées dans
`src/lib/reservation-page-data.ts`.

Le calcul des horaires disponibles est dans
`src/lib/reservation-availability.ts`.

Règles actuelles :

- pas de 30 minutes ;
- uniquement les plages futures actives ;
- durée autorisée : 60 ou 90 minutes ;
- un horaire doit être entièrement contenu dans une `AvailabilitySlot` ;
- les `Booking` `PENDING` et `CONFIRMED` bloquent les chevauchements ;
- les `Booking` `CANCELLED` et `EXPIRED` ne bloquent pas.

Le backend reste source de vérité dans `POST /api/bookings`.

## 8. Email et SMTP

Le SMTP maison se trouve dans `src/lib/smtp.ts`.

L'email de confirmation se trouve dans
`src/lib/booking-confirmation.ts`.

L'email envoyé est multipart :

- `text/plain`
- `text/html`

Le HTML contient :

- un titre ;
- le rappel du rendez-vous ;
- un bouton `Confirmer mon rendez-vous` ;
- un lien brut de secours ;
- un rappel de vérifier les spams.

Variables SMTP :

```env
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM_ADDRESS=""
SMTP_FROM_NAME=""
SMTP_FROM=""
APP_BASE_URL=""
```

`SMTP_FROM_ADDRESS` est l'adresse technique utilisée par le protocole SMTP
dans `MAIL FROM`.

`SMTP_FROM_NAME` est le nom affiché dans le header `From`.

`SMTP_FROM` reste un fallback legacy.

`APP_BASE_URL` sert à construire les liens de confirmation publics. Il doit
correspondre au domaine réellement accessible dans l'environnement concerné.

## 9. Authentification

L'auth admin se trouve dans `src/lib/auth.ts`.

Principe :

- un compte admin unique ;
- mot de passe hashé avec bcrypt ;
- session JWT signée avec `SESSION_SECRET` ;
- cookie `bienetre_session`, `httpOnly`, durée 8h.

Variables :

```env
ADMIN_USERNAME=""
ADMIN_PASSWORD_HASH=""
SESSION_SECRET=""
```

Générer un hash bcrypt :

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('mot-de-passe-admin', 12).then(console.log)"
```

Dans un fichier `.env`, les caractères `$` du hash bcrypt doivent être
échappés :

```env
ADMIN_PASSWORD_HASH="\$2b\$12\$..."
```

## 10. Lancement local

Installer les dépendances :

```bash
npm install
```

Démarrer PostgreSQL local :

```bash
docker compose up -d db
```

En local hors Docker, `DATABASE_URL` pointe vers PostgreSQL exposé sur la
machine :

```env
DATABASE_URL="postgresql://bienetre:bienetre_password@localhost:5432/bienetre_dashboard"
```

Générer le client Prisma :

```bash
npx prisma generate
```

Appliquer les migrations en développement :

```bash
npx prisma migrate dev
```

Démarrer Next.js :

```bash
npm run dev
```

Vérifier :

```bash
npm run lint
npm run build
```

Points d'attention :

- local hors Docker : hôte PostgreSQL `localhost` ;
- app dans Docker Compose : hôte PostgreSQL `db` ;
- ne pas lancer de migration contre la mauvaise base ;
- ne pas committer de secrets ;
- vérifier `APP_BASE_URL` avant de tester les emails.

## 11. Déploiement DEV VPS

Le dossier DEV prévu est :

```bash
/opt/apps/bienetre-dashboard-dev
```

Préparation :

```bash
sudo mkdir -p /opt/apps/bienetre-dashboard-dev
sudo chown -R $USER:$USER /opt/apps/bienetre-dashboard-dev
cd /opt/apps/bienetre-dashboard-dev
git clone <URL_DU_REPO> .
nano .env
```

Construire et lancer :

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Appliquer les migrations en DEV VPS :

```bash
docker compose -f docker-compose.dev.yml exec app npx prisma migrate deploy
```

Consulter les logs :

```bash
docker compose -f docker-compose.dev.yml logs -f app
docker compose -f docker-compose.dev.yml logs -f db
```

L'application DEV écoute sur :

```text
127.0.0.1:3006
```

Le domaine documenté est :

```text
dev.bienetre.alexsoutienscolaire.fr
```

Dans le `.env` VPS, `DATABASE_URL` doit utiliser l'hôte `db` :

```env
DATABASE_URL="postgresql://bienetre:bienetre_password@db:5432/bienetre_dashboard"
```

Variables importantes en DEV VPS :

```env
CALENDLY_TOKEN=""
DATABASE_URL=""
ADMIN_USERNAME=""
ADMIN_PASSWORD_HASH=""
SESSION_SECRET=""
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM_ADDRESS=""
SMTP_FROM_NAME=""
APP_BASE_URL=""
POSTGRES_DB=""
POSTGRES_USER=""
POSTGRES_PASSWORD=""
```

`POSTGRES_DB`, `POSTGRES_USER` et `POSTGRES_PASSWORD` doivent correspondre à
`DATABASE_URL`.

## 12. Sauvegarde et rollback

Avant toute migration importante sur VPS, faire une sauvegarde PostgreSQL.

Exemple DEV, à adapter aux valeurs réelles du `.env` :

```bash
docker compose -f docker-compose.dev.yml exec db pg_dump -U bienetre bienetre_dashboard > backup-dev.sql
```

Attention :

```bash
docker compose -f docker-compose.dev.yml down -v
```

supprime le volume PostgreSQL DEV
`bienetre_dashboard_dev_postgres_data`.

Rollback code :

```bash
git checkout <commit_precedent>
docker compose -f docker-compose.dev.yml up -d --build
```

Rollback base :

- ne se fait pas automatiquement avec le rollback code ;
- nécessite une sauvegarde SQL ou une stratégie de migration inverse ;
- doit être préparé avant toute migration risquée.

## 13. Existant vs reste à faire

### Existant

- Dashboard Calendly protégé.
- Paiements sur rendez-vous Calendly.
- Factures PDF liées aux paiements.
- Export CSV des paiements.
- Disponibilités internes.
- Réservation publique interne.
- Parcours premier rendez-vous et suivi.
- Confirmation email par token.
- Email HTML multipart.
- Agenda admin des réservations internes.

### Reste à faire

- Relier les `Booking` internes aux paiements.
- Relier les `Booking` internes aux factures.
- Inclure les `Booking` internes dans l'export CSV si nécessaire.
- Fusionner ou rapprocher l'agenda Calendly et l'agenda interne.
- Ajouter les notifications admin/client manquantes.
- Gérer les annulations/report côté client.
- Intégrer les URLs publiques dans WordPress.
- Définir une stratégie de remplacement progressif de Calendly.

## 14. Notes de prudence

- Ne pas refactorer trop vite `Payment.appointmentUid`.
- Ne pas renommer légèrement les routes facture sous `[appointmentUid]` :
  elles reçoivent en pratique un `Payment.id`.
- Ne pas considérer les `Booking` internes comme reliés aux paiements.
- Ne pas utiliser `docker compose down -v` sans sauvegarde.
- Vérifier `APP_BASE_URL` avant tout test email réel.
- Vérifier les variables SMTP avant tout test public.
- Faire un `pg_dump` avant toute migration VPS importante.
