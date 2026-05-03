# Bien-être Dashboard MVP

MVP Next.js App Router pour afficher les rendez-vous Google Calendar via iCal, protéger l'accès admin, persister les paiements dans PostgreSQL avec Prisma, et exporter les paiements en CSV.

## Prérequis

- Node.js
- Docker
- Une URL iCal Google Calendar privée

## Configuration

Crée les variables d'environnement depuis l'exemple :

```bash
cp .env.example .env.local
```

Variables nécessaires :

```env
ICAL_SECRET_URL=""
DATABASE_URL="postgresql://bienetre:bienetre_password@localhost:5432/bienetre_dashboard"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH=""
SESSION_SECRET=""
```

`ICAL_SECRET_URL` doit contenir l'URL iCal privée Google Calendar.

`ADMIN_PASSWORD_HASH` doit contenir un hash bcrypt, jamais le mot de passe en clair. Pour générer un hash :

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('mot-de-passe-admin', 12).then(console.log)"
```

`SESSION_SECRET` doit être une chaîne longue et aléatoire. Exemple de génération :

```bash
openssl rand -base64 32
```

## Développement

Démarre PostgreSQL :

```bash
docker compose up -d db
```

Si ton installation Docker utilise l'ancienne commande :

```bash
docker-compose up -d db
```

Applique la migration Prisma :

```bash
npx prisma migrate dev --name init
```

Lance l'application Next.js :

```bash
npm run dev
```

Pages utiles :

```text
http://localhost:3000/
http://localhost:3000/login
http://localhost:3000/dashboard
```
