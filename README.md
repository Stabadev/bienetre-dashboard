# Bien-être Dashboard MVP

MVP Next.js App Router pour afficher les rendez-vous Google Calendar via iCal et persister les paiements dans PostgreSQL avec Prisma.

## Prérequis

- Node.js
- Docker
- Une URL iCal Google Calendar privée

## Configuration

Crée les variables d'environnement depuis l'exemple :

```bash
cp .env.example .env.local
```

Renseigne `ICAL_SECRET_URL` dans `.env.local`.

La connexion PostgreSQL locale utilisée par Prisma est :

```env
DATABASE_URL="postgresql://bienetre:bienetre_password@localhost:5432/bienetre_dashboard"
```

## Développement

Démarre PostgreSQL :

```bash
docker compose up -d db
```

Applique la migration Prisma :

```bash
npx prisma migrate dev --name init
```

Lance l'application Next.js :

```bash
npm run dev
```

Dashboard :

```text
http://localhost:3000/dashboard
```
