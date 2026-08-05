# Prisma migrations

This project uses Prisma Migrate (not `db push`) for schema changes.

## First-time setup (existing database from db push)

If your database was created with `prisma db push` and already has tables:

```bash
cd apps/api

# Mark the baseline migration as already applied (does not run SQL)
npx prisma migrate resolve --applied 20260715000000_init

# Apply pending migrations (CRM workflow simplification)
npm run db:migrate
```

## Fresh database

```bash
cd apps/api
npm run db:migrate
npm run db:seed
```

## Production

```bash
cd apps/api
npm run db:migrate:deploy
```
