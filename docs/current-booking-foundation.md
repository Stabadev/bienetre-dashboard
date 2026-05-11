# Socle rendez-vous actuel

Ce document fige l'etat actuel avant le chantier de reservation interne.

## Source actuelle des rendez-vous

Calendly est la source de verite actuelle des rendez-vous.

Le code de recuperation se trouve dans `src/lib/calendar.ts`. Il appelle l'API Calendly cote serveur avec `CALENDLY_TOKEN`, puis expose au dashboard un format interne `CalendarEvent`.

L'application lit Calendly, mais ne cree, ne modifie et ne supprime pas de rendez-vous Calendly.

## Paiements et identifiant metier

Les paiements sont stockes dans le modele Prisma `Payment`.

`Payment.appointmentUid` est une cle metier unique qui relie un paiement au rendez-vous affiche dans le dashboard. Aujourd'hui, cette valeur est construite cote UI a partir de l'identifiant du rendez-vous Calendly et de sa date de debut.

Cette cle est utilisee pour :

- indexer les paiements dans l'UI dashboard ;
- sauvegarder ou mettre a jour un paiement via `/api/payments` ;
- supprimer un paiement via `/api/payments/[appointmentUid]` ;
- garantir l'unicite en base.

## Point d'attention facture

Certaines routes de facture sont sous un segment dynamique nomme `[appointmentUid]` :

- `/api/payments/[appointmentUid]/invoice`
- `/api/payments/[appointmentUid]/invoice/pdf`

Malgre ce nom de segment, ces routes recoivent en pratique un `Payment.id`, pas un `Payment.appointmentUid`. Les commentaires existants dans ces fichiers documentent ce compromis.

Ce nommage est conserve pour compatibilite. Il ne doit pas etre refactore pendant les passes documentaires ou les petites clarifications.

## Reservation interne future

La reservation interne est un chantier futur, prevu d'abord sur l'environnement DEV.

A ce stade :

- elle ne remplace pas Calendly ;
- elle n'est pas integree dans WordPress ;
- aucun modele `Booking` ou `AvailabilitySlot` n'existe ;
- aucune page `/reservation` n'existe ;
- aucune logique SMTP ou confirmation email par token n'existe.

Toute evolution devra donc accepter temporairement que plusieurs sources de rendez-vous puissent coexister.
