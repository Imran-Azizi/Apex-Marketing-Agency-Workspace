# Web production deploy assets

| Path | Purpose |
| ---- | ------- |
| `nginx/smartapex.tech.conf` | Reverse proxy + TLS placeholders |
| `.env.production.example` | Next.js public URL template → copy to `apps/web/.env.production` |

PM2 + DB backup scripts live in `apps/api/deploy/`.

Full guide: [`../../../DEPLOYMENT.md`](../../../DEPLOYMENT.md).
