# Socle rendez-vous actuel

Ce document décrit l'état actuel réel du socle rendez-vous après l'ajout de la
réservation interne.

## État actuel

Deux systèmes coexistent désormais :

- Calendly reste utilisé pour le dashboard historique, les paiements, les
  factures et l'export CSV.
- La réservation interne existe dans l'application pour les disponibilités,
  les demandes de rendez-vous client, la confirmation email et l'agenda admin
  des réservations.

La réservation interne ne remplace pas encore Calendly. Elle n'est pas encore
reliée au système de paiement/facture/export.

## Calendly

Calendly est récupéré dans `src/lib/calendar.ts`.

Le serveur appelle l'API Calendly avec `CALENDLY_TOKEN`, puis expose un format
interne `CalendarEvent` au dashboard principal.

L'application lit Calendly, mais ne crée, ne modifie et ne supprime aucun
rendez-vous Calendly.

Calendly alimente encore :

- `/dashboard` ;
- la saisie des paiements ;
- la création de factures ;
- l'export CSV.

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

Les paiements ne sont pas encore reliés aux `Booking` internes.

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

Julie peut :

- afficher une semaine lundi à samedi ;
- créer une plage de disponibilité à la souris ;
- supprimer une plage ;
- naviguer entre semaines ;
- copier une semaine vers la semaine suivante.

La copie de semaine est bloquée si la semaine suivante contient déjà au moins
une disponibilité active, afin d'éviter les doublons.

Réservations :

- page `/dashboard/reservations` ;
- composant `src/components/dashboard/InternalBookingsClient.tsx` ;
- API `/api/bookings` et `/api/bookings/[bookingId]`.

Julie peut :

- voir un agenda hebdomadaire des réservations internes ;
- voir les disponibilités en fond ;
- voir les rendez-vous `PENDING` et `CONFIRMED` au premier plan ;
- consulter les détails d'une réservation ;
- confirmer manuellement une demande ;
- marquer une réservation comme annulée.

Les statuts sont affichés avec un wording métier :

- `PENDING` : `En attente du clic client` ;
- `CONFIRMED` : `RDV confirmé` ;
- `CANCELLED` : `Annulé` ;
- `EXPIRED` : `Expiré`.

## Ce qui reste à faire

La réservation interne n'est pas encore connectée à :

- la saisie des paiements ;
- les factures ;
- l'export CSV ;
- le dashboard Calendly principal ;
- WordPress.

Il n'existe pas encore de couche unifiée "rendez-vous toutes sources".

Calendly et les Bookings internes doivent donc être considérés comme deux flux
séparés pour l'instant.

## Prudence

Avant toute migration ou bascule réelle :

- faire une sauvegarde PostgreSQL avec `pg_dump` ;
- vérifier `DATABASE_URL` selon l'environnement ;
- vérifier `APP_BASE_URL` pour les liens email ;
- vérifier les variables SMTP ;
- ne pas utiliser `docker compose down -v` sans sauvegarde ;
- ne pas refactorer trop vite `Payment.appointmentUid` ni les routes facture
  sous `[appointmentUid]`.
