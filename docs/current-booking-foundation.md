# Socle rendez-vous actuel

Ce document décrit l'état actuel réel du socle rendez-vous après l'ajout de la
réservation interne.

## État actuel

Deux systèmes coexistent pendant la transition :

- Calendly reste utilisé pour le dashboard historique, les paiements, les
  factures et l'export CSV.
- La réservation interne existe dans l'application pour les disponibilités,
  les demandes de rendez-vous client, la confirmation email et l'agenda admin
  des réservations.

La stratégie de transition retenue est progressive : les rendez-vous Calendly
sont synchronisés manuellement dans `Booking` pour bloquer les créneaux publics,
mais Calendly reste disponible tant que les liens WordPress n'ont pas été
remplacés par les pages internes.

## Calendly

Calendly est récupéré dans `src/lib/calendar.ts`.

Le serveur appelle l'API Calendly avec `CALENDLY_TOKEN`, puis expose un format
interne `CalendarEvent` au dashboard principal.

L'application lit Calendly, mais ne crée, ne modifie et ne supprime aucun
rendez-vous Calendly.

Le dashboard principal garde son comportement historique : il lit Calendly via
`getCalendarEvents()` avec une fenêtre par défaut d'environ 30 jours.

En parallèle, l'admin peut lancer une synchronisation manuelle depuis
`/dashboard/reservations`. Cette sync appelle :

- `POST /api/admin/calendly/sync`
- `getCalendarEvents({ forceRefresh: true, maxDaysAhead: 186 })`

Elle crée ou met à jour des `Booking` avec `source = CALENDLY`, sur un horizon
d'environ 6 mois. Elle est idempotente grâce à l'unicité
`(source, externalEventUri)`.

Calendly alimente encore directement :

- `/dashboard` ;
- la saisie des paiements ;
- la création de factures ;
- l'export CSV.

Calendly alimente aussi indirectement l'agenda interne via les `Booking
CALENDLY` synchronisés.

## Paiements et identifiant métier

Les paiements sont stockés dans le modèle Prisma `Payment`.

`Payment.appointmentUid` est une clé métier unique qui relie un paiement au
rendez-vous affiché dans le dashboard Calendly. Aujourd'hui, cette valeur est
construite côté UI à partir de l'identifiant du rendez-vous Calendly et de sa
date de début.

Cette clé est utilisée pour :

- indexer les paiements dans l'UI dashboard ;
- sauvegarder ou mettre à jour un paiement via `/api/payments` ;
- supprimer un paiement via `/api/payments/[appointmentUid]` ;
- garantir l'unicité en base.

Pour les `Booking INTERNAL` confirmés affichés dans `/dashboard`, le paiement
utilise temporairement un identifiant artificiel :

```text
appointmentUid = booking:{booking.id}
```

Il n'existe pas encore de relation Prisma `Payment.bookingId`.
`appointmentUid` reste donc une dette legacy à conserver pendant la transition,
puis à nettoyer plus tard.

## Point d'attention facture

Certaines routes de facture sont sous un segment dynamique nommé
`[appointmentUid]` :

- `/api/payments/[appointmentUid]/invoice`
- `/api/payments/[appointmentUid]/invoice/pdf`

Malgré ce nom de segment, ces routes reçoivent en pratique un `Payment.id`, pas
un `Payment.appointmentUid`. Les commentaires existants dans ces fichiers
documentent ce compromis.

Ce nommage est conservé pour compatibilité. Il ne doit pas être renommé dans
une simple passe documentaire ou une petite correction.

## Réservation interne

La réservation interne existe maintenant.

Modèles Prisma :

- `AvailabilitySlot` représente une plage de disponibilité ouverte par Julie.
- `Booking` représente une demande ou un rendez-vous client interne.
- `BookingStatus` contient `PENDING`, `CONFIRMED`, `CANCELLED`, `EXPIRED`.
- `BookingSource` contient `INTERNAL`, `CALENDLY`, `ADMIN`.

Pages publiques :

- `/reservation` : choix du parcours.
- `/reservation/premier-rdv` : parcours premier rendez-vous, durée 1h30.
- `/reservation/suivi` : parcours suivi, durée 1h.
- `/reservation/confirmer` : confirmation par token reçu par email.

Le calcul des horaires disponibles se trouve principalement dans :

- `src/lib/reservation-page-data.ts`
- `src/lib/reservation-availability.ts`

Les horaires sont générés par pas de 30 minutes, à partir des
`AvailabilitySlot` actives futures. Les `Booking` en statut `PENDING` ou
`CONFIRMED` bloquent les horaires qui chevauchent. Les statuts `CANCELLED` et
`EXPIRED` ne bloquent pas.

Les pages publiques `/reservation/*` ne contactent jamais Calendly. Elles lisent
uniquement la base interne :

- `AvailabilitySlot` ;
- `Booking INTERNAL` ;
- `Booking CALENDLY`.

Les `Booking CALENDLY` synchronisés en statut `CONFIRMED` bloquent donc
naturellement les créneaux publics déjà occupés dans Calendly.

Le backend de création de réservation est `POST /api/bookings`. Il vérifie :

- la durée autorisée, 60 ou 90 minutes ;
- la présence des informations client requises ;
- l'existence d'une plage de disponibilité couvrante ;
- l'absence de chevauchement avec un Booking actif.

## Confirmation email

Les emails de confirmation sont envoyés via le SMTP maison dans
`src/lib/smtp.ts`.

Le template de confirmation se trouve dans `src/lib/booking-confirmation.ts`.

L'email est multipart :

- `text/plain` ;
- `text/html`.

Le HTML contient un bouton de confirmation et un lien brut de secours.

Variables importantes :

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_ADDRESS`
- `SMTP_FROM_NAME`
- `SMTP_FROM` comme fallback legacy
- `APP_BASE_URL`

`SMTP_FROM_ADDRESS` est l'adresse technique utilisée dans `MAIL FROM`.
`SMTP_FROM_NAME` est le nom affiché dans le header `From`.

`APP_BASE_URL` sert à construire le lien public de confirmation.

## Admin Julie

Disponibilités :

- page `/dashboard/disponibilites` ;
- composant `src/components/dashboard/AvailabilitySlotsClient.tsx` ;
- API `/api/availability-slots`.

Routes API :

- `GET /api/availability-slots` liste les disponibilités ;
- `POST /api/availability-slots` crée une disponibilité ;
- `PATCH /api/availability-slots/[slotId]` modifie `startAt` et `endAt` ;
- `DELETE /api/availability-slots/[slotId]` supprime une disponibilité.

`PATCH /api/availability-slots/[slotId]` vérifie que la disponibilité existe,
que les dates sont valides, que `endAt` est strictement après `startAt`, et que
les horaires sont alignés sur un pas de 15 minutes.

Julie peut :

- afficher une grille lundi à samedi, de 06:00 à 20:00 ;
- créer une plage de disponibilité par clic-glisser sur le fond de l'agenda ;
- éditer une plage existante via une modale au clic ;
- modifier l'heure de début et l'heure de fin par boutons rapides ou listes
  déroulantes ;
- déplacer verticalement une plage par drag-and-drop dans la même journée ;
- supprimer une plage depuis la carte ou la modale ;
- voir les `Booking INTERNAL` et `Booking CALENDLY` en overlay lecture seule ;
- afficher ou masquer localement les overlays internes et Calendly ;
- naviguer entre semaines ;
- copier les disponibilités visibles vers la semaine N+1 ou N+2.

L'agenda admin des disponibilités est manipulé par pas de 15 minutes. Les heures
pleines sont renforcées visuellement dans la grille pour distinguer rapidement
les débuts d'heure. Pendant le déplacement vertical d'une plage, la durée est
conservée et la sauvegarde serveur se fait uniquement au relâchement du pointer.
En cas d'erreur API, l'affichage revient à la position précédente.

Un simple clic dans la grille ne crée plus automatiquement de disponibilité.
La création demande une sélection d'au moins 30 minutes, afin d'éviter les
mini-plages accidentelles lorsqu'on clique rapidement dans la grille ou sur une
zone occupée visuellement par un rendez-vous.

Les overlays de rendez-vous sont informatifs seulement :

- `Booking INTERNAL` : rose ;
- `Booking CALENDLY` : bleu ;
- disponibilité : vert pâle ;
- overlays non interactifs, sans modification possible du `Booking` depuis
  cette page.

Le but UX de `/dashboard/disponibilites` est de permettre à Julie de définir
ses disponibilités tout en voyant immédiatement les rendez-vous déjà pris. Les
disponibilités restent les seuls éléments modifiables.

Les messages de succès ou d'erreur sont affichés sous forme de toasts flottants
hors layout, afin de ne pas décaler l'agenda.

La copie de semaine est bloquée si la semaine cible N+1 ou N+2 contient déjà au
moins une disponibilité active, afin d'éviter les doublons. Il n'existe pas de
route dédiée à la copie : elle reste côté client et crée les disponibilités via
plusieurs appels `POST /api/availability-slots`.

Les créneaux proposés au public dans le parcours de réservation restent générés
par pas de 30 minutes pour l'instant.

Réservations :

- page `/dashboard/reservations` ;
- composant `src/components/dashboard/InternalBookingsClient.tsx` ;
- API `/api/bookings` et `/api/bookings/[bookingId]` ;
- sync Calendly via `POST /api/admin/calendly/sync`.

Julie peut :

- voir un agenda hebdomadaire des réservations internes et des rendez-vous
  Calendly synchronisés ;
- voir les disponibilités en arrière-plan informatif ;
- voir les rendez-vous `PENDING` et `CONFIRMED` au premier plan ;
- consulter les détails d'une réservation dans une modale au clic ;
- confirmer manuellement une demande ;
- marquer une réservation interne comme annulée ;
- lancer une synchronisation manuelle Calendly.

La page `/dashboard/reservations` privilégie les `Booking` comme information
principale. Les disponibilités sont seulement un contexte visuel :

- zones hors disponibilité : fond gris clair hachuré ;
- disponibilités : vert ultra pâle, sans texte, avec repères visuels de début
  et de fin ;
- rendez-vous Calendly : bleu ;
- rendez-vous internes : rose ;
- rendez-vous admin éventuels : gris discret.

La grille horaire est affichée en pas visuel de 15 minutes :

- heure pleine : trait le plus visible ;
- demi-heure : trait intermédiaire ;
- quart d'heure : trait discret.

Les détails ne sont plus affichés sous la grille. Un clic sur un rendez-vous
ouvre une modale contenant client, source, statut, service, date, heure,
email, téléphone et message éventuel. Les actions internes existantes sont
conservées lorsqu'elles sont pertinentes.

La synchronisation Calendly est accessible dans un en-tête compact, avec les
badges de synthèse `confirmés` et `en attente`. Le résultat de sync reste
affiché après action, mais sans occuper une carte pleine largeur.

Les rendez-vous `CALENDLY` synchronisés sont affichés en lecture seule. Les
actions de confirmation et d'annulation sont désactivées dans l'application,
car elles ne modifient pas réellement Calendly.

Les statuts sont affichés avec un wording métier :

- `PENDING` : `En attente du clic client` ;
- `CONFIRMED` : `RDV confirmé` ;
- `CANCELLED` : `Annulé` ;
- `EXPIRED` : `Expiré`.

## Timezone Europe/Paris

Le fuseau métier de l'application est `Europe/Paris`. Julie travaille en
France et les pages admin doivent afficher les rendez-vous en heure locale
France, même si le serveur tourne en UTC.

Les dates stockées et échangées restent des instants ISO/UTC, mais le rendu
visuel des agendas doit convertir explicitement vers `Europe/Paris`.

Un bug a été identifié sur VPS DEV dans `/dashboard/reservations` : après un
refresh navigateur, les rendez-vous pouvaient apparaître 2h trop tôt en mai.
La cause était l'utilisation de `Date#getHours()` / `Date#getMinutes()` pour
calculer les positions verticales. Sur un runtime UTC, `08:00 Europe/Paris`
était interprété comme `06:00`.

La correction actuelle utilise `Intl.DateTimeFormat` avec
`timeZone: "Europe/Paris"` pour extraire les heures/minutes servant au
positionnement vertical de l'agenda réservations. Les formatters partagés de
`src/components/dashboard/formatters.ts` utilisent également `Europe/Paris`
pour l'affichage texte.

Recommandation : toute future logique visuelle d'agenda ou de disponibilités
doit éviter `getHours()` / `getMinutes()` si l'intention métier est l'heure
France. Utiliser un helper explicite `Europe/Paris` ou un formatter
`Intl.DateTimeFormat` configuré avec `timeZone: "Europe/Paris"`.

## Ce qui reste à faire

La transition est partielle. L'existant couvre maintenant :

- sync manuelle Calendly vers `Booking CALENDLY` ;
- blocage des créneaux publics par les `Booking CALENDLY` ;
- affichage lecture seule des `Booking CALENDLY` dans l'admin réservations ;
- affichage des `Booking INTERNAL` confirmés dans `/dashboard` ;
- paiement des `Booking INTERNAL` via `appointmentUid = booking:{id}`.
- overlays de rendez-vous dans `/dashboard/disponibilites` ;
- agenda hebdomadaire `/dashboard/reservations` avec disponibilités en
  arrière-plan, rendez-vous au premier plan et détail en modale ;
- correction du positionnement horaire de l'agenda en `Europe/Paris`.

Il reste à faire :

- remplacer les liens WordPress Calendly par les pages internes ;
- faire une dernière synchronisation Calendly juste avant cette bascule ;
- gérer proprement les annulations/report Calendly après sync ;
- remplacer progressivement `appointmentUid` par une vraie clé rendez-vous
  interne ;
- ajouter une relation durable entre `Payment` et `Booking` si nécessaire.

Limite connue : `getCalendarEvents()` ne retourne actuellement que les
événements Calendly actifs. Une annulation Calendly après synchronisation peut
laisser un `Booking CALENDLY` bloquant tant qu'une stratégie de désactivation
des absents ou de récupération des annulés n'a pas été ajoutée.

## Prudence

Avant toute migration ou bascule réelle :

- faire une sauvegarde PostgreSQL avec `pg_dump` ;
- vérifier `DATABASE_URL` selon l'environnement ;
- vérifier `APP_BASE_URL` pour les liens email ;
- vérifier les variables SMTP ;
- faire une dernière sync Calendly avant la bascule WordPress vers
  `/reservation/premier-rdv` et `/reservation/suivi` ;
- ne pas utiliser `docker compose down -v` sans sauvegarde ;
- ne pas refactorer trop vite `Payment.appointmentUid` ni les routes facture
  sous `[appointmentUid]`.
