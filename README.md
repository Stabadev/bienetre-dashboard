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

Ces deux flux coexistent pendant une transition progressive. Calendly peut être
synchronisé manuellement vers `Booking` afin que les rendez-vous déjà pris
bloquent les créneaux de réservation interne.

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
- Dashboard admin protégé sur `/dashboard`, avec les rendez-vous Calendly
  historiques et les `Booking INTERNAL` confirmés.
- Suivi des paiements associés aux rendez-vous Calendly.
- Paiement possible des `Booking INTERNAL` confirmés via un `appointmentUid`
  temporaire au format `booking:{id}`.
- Création et modification de paiements.
- Suppression d'un paiement sans supprimer le rendez-vous Calendly.
- Factures PDF liées aux paiements.
- Export CSV des paiements.

Calendly est lu en lecture seule. L'application ne crée, ne modifie et ne
supprime aucun rendez-vous Calendly.

La synchronisation Calendly vers `Booking` est manuelle depuis
`/dashboard/reservations`. Elle couvre environ 6 mois dans le futur et crée ou
met à jour des `Booking` avec `source = CALENDLY`.

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
- Affichage des `Booking CALENDLY` synchronisés en lecture seule dans
  l'agenda admin des réservations.

L'agenda admin des disponibilités fonctionne par pas de 15 minutes. Les pages
publiques respectent désormais ces quarts d'heure : une plage Julie commençant
à 13:15 peut proposer un rendez-vous à 13:15 si le créneau est pertinent.

Les parcours publics `/reservation/suivi` et `/reservation/premier-rdv` sont
présentés comme un tunnel mobile-first :

- choix du mois ;
- choix d'un jour contenant des créneaux proposés ;
- choix d'un horaire ;
- affichage du formulaire coordonnées seulement après sélection d'un horaire ;
- envoi via le CTA `Recevoir mon email de confirmation`.

Après succès, le formulaire disparaît et un message explique que l'email a été
envoyé, qu'il faut cliquer sur le lien reçu, vérifier les spams, et que le
rendez-vous n'est pas confirmé sans validation email. Si le mois courant ne
contient aucun créneau, l'interface affiche automatiquement le prochain mois
utile. Si Julie ou le client revient manuellement sur un mois vide, un message
simple indique qu'aucun créneau n'est proposé ce mois-ci.

Les créneaux visibles sont limités à 4 par jour. La préparation cherche à garder
quelques choix simples, avec une répartition matin/après-midi si possible.

Les pages publiques `/reservation/*` ne contactent pas Calendly. Elles lisent
uniquement `AvailabilitySlot` et `Booking`. Les `Booking CALENDLY` synchronisés
en statut `CONFIRMED` bloquent donc les créneaux publics.

### Admin Julie

Julie peut aujourd'hui :

- se connecter à l'admin ;
- consulter le dashboard Calendly historique ;
- saisir et modifier des paiements Calendly ;
- saisir un paiement pour un `Booking INTERNAL` confirmé visible dans
  `/dashboard` ;
- générer des factures liées aux paiements ;
- exporter les paiements en CSV ;
- créer, éditer, déplacer et supprimer des plages de disponibilité ;
- copier une semaine de disponibilités vers la semaine N+1 ou N+2, avec
  blocage si la semaine cible contient déjà des disponibilités actives ;
- consulter les réservations internes dans un agenda hebdomadaire ;
- synchroniser manuellement les rendez-vous Calendly dans l'agenda des
  réservations ;
- voir les disponibilités en fond dans l'agenda des réservations ;
- confirmer manuellement une demande ;
- marquer une réservation comme annulée.

Les rendez-vous `CALENDLY` synchronisés sont affichés en lecture seule dans
l'admin réservations. Les actions internes de confirmation/annulation sont
désactivées car elles ne modifient pas Calendly.

### UX disponibilités et agenda

`/dashboard/disponibilites` sert à définir les plages proposées aux clients sur
les pages de réservation internes. La grille est affichée par pas de 15 minutes
et les plages se créent par drag. Un simple clic ne crée plus de disponibilité :
la création demande au moins 30 minutes, afin d'éviter les mini-plages
accidentelles.

Les disponibilités restent les seuls éléments modifiables sur cette page :
édition via modale, déplacement vertical par drag, suppression depuis la modale
ou l'action du bloc. Les rendez-vous déjà pris sont affichés en overlay
lecture seule pour aider Julie à visualiser les zones occupées pendant qu'elle
définit ses disponibilités.

Convention visuelle de `/dashboard/disponibilites` :

- disponibilités : vert pâle, élément principal de la grille ;
- `Booking INTERNAL` : overlay rose ;
- `Booking CALENDLY` : overlay bleu ;
- overlays non interactifs, avec filtres locaux afficher/masquer internes et
  Calendly.

`/dashboard/reservations` est une vue agenda hebdomadaire. Elle affiche les
rendez-vous internes et Calendly ensemble, avec les disponibilités seulement en
arrière-plan informatif. Les rendez-vous sont les éléments principaux.

Convention visuelle de `/dashboard/reservations` :

- zones hors disponibilité : gris clair hachuré ;
- disponibilités : fond vert ultra pâle avec repères de début/fin ;
- RDV Calendly : bleu ;
- RDV internes : rose ;
- RDV admin éventuels : gris discret ;
- grille horaire avec heure pleine, demi-heure et quart d'heure distingués.

Un clic sur un rendez-vous ouvre une modale de détail. Les détails ne sont plus
affichés sous la grille. La synchronisation Calendly et les compteurs confirmés
/ en attente sont compactés dans l'en-tête de la page.

### Timezone Europe/Paris

Julie travaille en France ; l'interface métier doit donc raisonner en heure
`Europe/Paris` pour l'affichage et le positionnement visuel des rendez-vous.

Un bug a été identifié sur VPS DEV : après refresh navigateur, les rendez-vous
de `/dashboard/reservations` pouvaient apparaître 2h trop tôt, car le calcul de
position utilisait `getHours()` / `getMinutes()` dans le fuseau du runtime UTC.

Le positionnement vertical de l'agenda réservations est maintenant calculé avec
`Intl.DateTimeFormat` en `Europe/Paris`. Toute future logique visuelle
d'agenda ou de disponibilité doit utiliser des helpers timezone explicites, et
éviter `Date#getHours()` / `Date#getMinutes()` quand l'heure métier attendue est
l'heure France.

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

POST   /api/admin/calendly/sync

GET    /api/availability-slots
POST   /api/availability-slots
PATCH  /api/availability-slots/[slotId]
DELETE /api/availability-slots/[slotId]

GET    /api/bookings
POST   /api/bookings
PATCH  /api/bookings/[bookingId]
```

`POST /api/bookings` est public car il sert au formulaire de réservation.
`GET /api/bookings` et `PATCH /api/bookings/[bookingId]` sont protégés.
`POST /api/admin/calendly/sync` est protégé et ne doit être appelé que depuis
l'admin.

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

Pour les `Booking INTERNAL` confirmés, l'application utilise temporairement :

```text
appointmentUid = booking:{booking.id}
```

`appointmentUid` reste legacy et devra être remplacé plus tard par une clé
métier interne plus robuste.

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
- `externalEventUri`
- `externalInviteeUri`
- `externalEventTypeUri`
- `externalStatus`
- `externalUpdatedAt`
- `syncedAt`

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

La sync admin `POST /api/admin/calendly/sync` réutilise `getCalendarEvents()`
avec un horizon étendu :

```text
maxDaysAhead = 186
```

Le dashboard principal garde la fenêtre Calendly par défaut, environ 30 jours.
La sync crée/met à jour des `Booking CALENDLY` idempotents via
`(source, externalEventUri)`.

Limite connue : si un rendez-vous Calendly est annulé après synchronisation,
le `Booking CALENDLY` déjà créé peut rester bloquant tant qu'une stratégie de
désactivation des absents ou de récupération des annulés n'a pas été ajoutée.

## 7. Réservation interne

Les parcours publics sont configurés dans `src/lib/reservation-services.ts`.

Durées :

- premier rendez-vous : 90 minutes ;
- suivi : 60 minutes.

Les données nécessaires aux pages de réservation sont préparées dans
`src/lib/reservation-page-data.ts`.

La préparation des créneaux affichés au public est dans
`src/lib/reservation-display-slots.ts`, appelée depuis
`src/lib/reservation-page-data.ts`. L'ancien calcul technique dans
`src/lib/reservation-availability.ts` reste présent, mais le parcours public
utilise maintenant le moteur d'affichage optimisé.

Règles actuelles :

- préparation publique par pas technique de 15 minutes ;
- respect des quarts d'heure définis dans les `AvailabilitySlot` ;
- construction à partir des `AvailabilitySlot`, des `Booking` bloquants, de la
  durée du service et de `now` ;
- découpage des plages en blocs libres réels après retrait des rendez-vous
  existants ;
- proposition du début et de la fin de chaque bloc libre utile ;
- priorité aux créneaux collés aux rendez-vous existants ;
- évitement autant que possible des trous inutilisables de 30 minutes ;
- maximum 4 créneaux visibles par jour ;
- logique pensée pour compacter l'agenda, réduire les temps morts et garder
  quelques choix simples côté client ;
- durée autorisée : 60 ou 90 minutes ;
- un horaire doit être entièrement contenu dans une `AvailabilitySlot` ;
- les `Booking` `PENDING` et `CONFIRMED` bloquent les chevauchements ;
- les `Booking` `CANCELLED` et `EXPIRED` ne bloquent pas.

Les pages publiques ne font aucun appel Calendly. Avant de remplacer les liens
Calendly du site WordPress par `/reservation/premier-rdv` et
`/reservation/suivi`, il faut lancer une dernière synchronisation Calendly.

Le backend reste source de vérité dans `POST /api/bookings`.

Ce chantier n'a pas modifié Prisma, Calendly, la synchronisation Calendly, le
dashboard admin, le schéma de base de données, ni les migrations.

Vérifications réalisées après la V1.1 du parcours public :

- `npx tsc --noEmit` : OK ;
- `npm run lint` : OK ;
- deux warnings `jsx-a11y/alt-text` restent présents dans
  `src/components/invoices/InvoicePdfDocument.tsx`, sans lien avec ce chantier.

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
- Affichage des `Booking INTERNAL` confirmés dans le dashboard principal.
- Paiements sur `Booking INTERNAL` via `appointmentUid = booking:{id}`.
- Factures PDF liées aux paiements.
- Export CSV des paiements.
- Disponibilités internes.
- Réservation publique interne.
- Parcours premier rendez-vous et suivi.
- Confirmation email par token.
- Email HTML multipart.
- Agenda admin des réservations internes.
- Sync manuelle Calendly vers `Booking CALENDLY`.
- Blocage des créneaux publics par les `Booking CALENDLY`.
- Affichage lecture seule des `Booking CALENDLY` dans l'admin réservations.
- Overlays RDV dans `/dashboard/disponibilites`.
- Vue agenda hebdomadaire lisible dans `/dashboard/reservations`, avec détail
  RDV en modale.
- Calcul visuel des positions agenda en `Europe/Paris`.

### Reste à faire

- Remplacer progressivement `appointmentUid` par une vraie clé rendez-vous
  interne.
- Relier durablement `Payment` à `Booking` si nécessaire.
- Gérer les annulations/report Calendly après synchronisation.
- Ajouter les notifications admin/client manquantes.
- Gérer les annulations/report côté client.
- Intégrer les URLs publiques dans WordPress.
- Définir une stratégie de remplacement progressif de Calendly.

## 14. Notes de prudence

- Ne pas refactorer trop vite `Payment.appointmentUid`.
- Ne pas renommer légèrement les routes facture sous `[appointmentUid]` :
  elles reçoivent en pratique un `Payment.id`.
- Ne pas considérer `appointmentUid = booking:{id}` comme une architecture
  définitive.
- Faire une dernière sync Calendly avant la bascule WordPress vers les pages de
  réservation internes.
- Ne pas utiliser `docker compose down -v` sans sauvegarde.
- Vérifier `APP_BASE_URL` avant tout test email réel.
- Vérifier les variables SMTP avant tout test public.
- Faire un `pg_dump` avant toute migration VPS importante.
