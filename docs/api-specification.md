# APEX Workspace — API Specification

Base URL: `/api/v1`  
Auth: HTTP-only cookies (`access_token`, `refresh_token`)  
CSRF: header `X-CSRF-Token` for state-changing requests  
Locale: optional `Accept-Language: fa|en`

## Conventions

| Code | Meaning |
|------|---------|
| 200/201 | Success |
| 400 | Validation |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (e.g. duplicate WhatsApp) |
| 429 | Rate limited |

Envelope:

```json
{ "success": true, "data": {}, "meta": {} }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

---

## Auth

| Method | Path | Perm | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | public | Internal user login |
| POST | `/auth/portal/login` | public | Portal WhatsApp+password |
| POST | `/auth/refresh` | cookie | Rotate refresh |
| POST | `/auth/logout` | auth | Revoke current session |
| POST | `/auth/logout-all` | auth | Revoke all sessions |
| GET | `/auth/me` | auth | Current principal |
| GET | `/auth/csrf` | public | Issue CSRF token cookie |

## Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/services` | Service cards |
| GET | `/public/styles` | Video styles |
| GET | `/public/narrators` | Active narrator profiles (portal brief selection) |
| GET | `/public/portfolio` | Published items + filters |
| GET | `/public/portfolio/:slug` | Detail |
| GET | `/public/whatsapp-cta` | Build WhatsApp URL from settings |

## CRM

| Method | Path | Perm |
|--------|------|------|
| GET/POST | `/crm/customers` | crm:read / crm:write |
| GET/PATCH | `/crm/customers/:id` | crm:read / crm:write |
| DELETE | `/crm/customers/:id` | crm:write |
| POST | `/crm/customers/check-duplicate` | crm:read |
| POST | `/crm/customers/merge` | crm:write (MANAGER/SALES) |
| PATCH | `/crm/opportunities/:id` | opportunity:manage |
| PATCH | `/crm/opportunities/:id/stage` | opportunity:manage |
| POST | `/crm/opportunities/:id/deposit-invoice` | finance:write |
| GET | `/crm/opportunities/:id/invite-eligibility` | portal_invite:create |
| POST | `/crm/opportunities/:id/portal-invite` | portal_invite:create |
| POST | `/crm/payments` | finance:write |
| POST | `/crm/payments/:id/verify` | finance:write |

Portal invite eligibility requires: customer phone, order confirmed (`ORDER_CONFIRMED` or `COMPLETED`), and accepted price/terms. CRM sales stages are: `NEW_LEAD`, `CONTACTED`, `INTERESTED`, `PRICE_SENT`, `ORDER_CONFIRMED`, `COMPLETED`, `CANCELED`.

## Portal

| Method | Path | Perm |
|--------|------|------|
| GET | `/portal/invite/:token` | public |
| POST | `/portal/invite/:token/request-otp` | public |
| POST | `/portal/invite/:token/register` | public |
| GET | `/portal/dashboard` | CUSTOMER |
| GET | `/portal/projects` | CUSTOMER |
| GET | `/portal/projects/:id` | CUSTOMER (scoped) |
| POST | `/portal/projects/:id/brief` | CUSTOMER |
| POST | `/portal/content/:versionId/approve` | content:approve_client |
| POST | `/portal/content/:versionId/request-changes` | content:approve_client |
| POST | `/portal/final/:versionId/approve` | content:approve_client |
| POST | `/portal/final/:versionId/request-changes` | content:approve_client |
| GET | `/portal/invoices` | finance:read own |
| GET | `/portal/downloads/:projectId` | download:clean gated |
| POST | `/portal/orders` | creates Opportunity only |
| GET | `/portal/profile` | own |
| PATCH | `/portal/profile` | own |

## Projects (internal)

| Method | Path | Perm |
|--------|------|------|
| GET | `/projects` | project:read |
| GET | `/projects/:id` | project:read |
| POST | `/projects/:id/start` | project:start |
| PATCH | `/projects/:id` | project:write |
| POST | `/projects/:id/assign` | project:write |
| GET | `/projects/:id/context` | project:read |
| POST | `/projects/:id/content/generate` | content:generate |
| POST | `/projects/:id/content/:versionId/approve-for-client` | content:approve_internal |
| POST | `/projects/:id/extra-revision` | Manager |
| POST | `/projects/:id/voice/accept` | narration:assign |
| POST | `/projects/:id/voice/return` | narration:assign |
| POST | `/projects/:id/production/submit` | production:submit |
| POST | `/projects/:id/final/approve-for-client` | content:approve_internal |
| POST | `/projects/:id/final/return-editor` | content:approve_internal |

## AI

| Method | Path | Perm |
|--------|------|------|
| POST | `/ai/:projectId/run` | ai:run — body: `{ agentType }` |
| GET | `/ai/:projectId/runs` | project:read |
| GET | `/ai/runs/:id` | project:read |

## Finance

| Method | Path | Perm |
|--------|------|------|
| GET/POST | `/finance/invoices` | finance:* |
| GET | `/finance/projects/:id` | finance:read |
| POST | `/finance/payments` | finance:write |
| POST | `/finance/payments/:id/verify` | finance:write |
| GET/POST | `/finance/expenses` | finance:write |
| GET | `/finance/payables` | finance:read |
| PATCH | `/finance/payables/:id/pay` | finance:write |
| GET | `/finance/dashboard` | finance:read |

## Delivery

| Method | Path | Perm |
|--------|------|------|
| POST | `/delivery/:projectId/allow` | download:allow |
| POST | `/delivery/:projectId/revoke` | download:allow |
| GET | `/delivery/:projectId/signed-url` | download:clean gated |
| GET | `/delivery/:projectId/history` | download:allow |

## Portfolio

| Method | Path | Perm |
|--------|------|------|
| POST | `/portfolio/from-project/:projectId` | portfolio:manage |
| PATCH | `/portfolio/:id` | portfolio:manage |
| POST | `/portfolio/:id/publish` | portfolio:publish |
| POST | `/portfolio/:id/unpublish` | portfolio:publish |

## Team / Settings / Notifications / Audit

| Method | Path | Perm |
|--------|------|------|
| CRUD | `/team/profiles` | team:manage |
| CRUD | `/settings` | settings:manage |
| GET | `/notifications` | notification:read |
| PATCH | `/notifications/:id/read` | own |
| GET | `/audit` | audit:read |

## Files

| Method | Path | Perm |
|--------|------|------|
| POST | `/files/upload` | auth + context |
| GET | `/files/signed/:key` | auth + ACL |

---

## Status Code Notes for Gates

- Portal invite before deposit verified → **403** `INVITE_NOT_ELIGIBLE` (AC-03)
- Clean download with balance > 0 → **403** `BALANCE_OUTSTANDING` (AC-20)
- Clean download without allow → **403** `DOWNLOAD_LOCKED` (AC-21)
- Portfolio create when NOT_ALLOWED → **403** (AC-24)
