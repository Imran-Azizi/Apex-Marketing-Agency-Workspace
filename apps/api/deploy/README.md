# API production deploy assets

| Path | Purpose |
| ---- | ------- |
| `ecosystem.config.cjs` | PM2 processes for `apex-api` + `apex-web` |
| `.env.production.example` | API secrets template → copy to `apps/api/.env` |
| `scripts/backup-postgres.sh` | Daily `pg_dump` |
| `scripts/bootstrap-dirs.sh` | App user/dirs helper |

Nginx site config lives in `apps/web/deploy/nginx/`.

Full guide: [`../../../DEPLOYMENT.md`](../../../DEPLOYMENT.md).
