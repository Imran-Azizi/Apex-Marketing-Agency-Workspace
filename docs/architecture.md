# APEX Workspace — Architecture Document

**Version:** 3.0 aligned | **Product:** APEX Workspace | **Owner:** Apex Smart Marketing

## 1. System Context

APEX Workspace is a private enterprise operational platform that manages the full lifecycle from CRM lead through content production, client approval, payment, secure delivery, and portfolio publication.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Public Web  │     │ Internal App │     │ Customer Portal │
│ (SEO/CTA)   │     │ (Desktop)    │     │ (Mobile-first)  │
└──────┬──────┘     └──────┬───────┘     └────────┬────────┘
       │                   │                      │
       └───────────────────┼──────────────────────┘
                           │ HTTPS + HTTP-only cookies
                    ┌──────▼──────┐
                    │ Express API │
                    │  REST / ESM │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
     PostgreSQL      Object Storage    AI Provider
     (Prisma)        (Local / S3)      (OpenAI-compat / Mock)
```

## 2. High-Level Principles (Immutable)

| Code | Principle |
|------|-----------|
| P-01 | All leads stay in CRM |
| P-02 | Portal/Project only after deposit-confirmed customer |
| P-03 | Normalized WhatsApp is unique customer identity |
| P-04 | One portal profile, many projects |
| P-05 | Project requires customer_id + manager_id |
| P-06 | Client Assets stored once; projects reference |
| P-07 | AI agents remain in sales/content/QC/portfolio flows |
| P-08 | Humans approve; AI never publishes/approves/deletes/finance |
| P-09 | Version everything; never overwrite |
| P-10 | Clean download only after balance=0 + allow flag |

## 3. Application Layers

### Backend (`apps/api`)

| Layer | Responsibility |
|-------|----------------|
| Routes | HTTP mapping, middleware chain |
| Controllers | Request/response orchestration |
| Validators | Zod / custom schema validation |
| Services | Business rules, transactions |
| Database | Prisma ORM |
| Adapters | Storage, AI, WhatsApp CTA builder |

### Frontend (`apps/web`)

| Layer | Responsibility |
|-------|----------------|
| App Router | Locale-aware routes, layouts |
| Features | Domain UI (CRM, projects, portal) |
| Components | shadcn/ui primitives |
| Lib | API client (credentials: include), auth helpers |
| State | TanStack Query (server), Zustand (UI shell) |

## 4. Authentication Model

- **Access token** + **Refresh token** in HTTP-only Secure cookies
- **SameSite**: Lax (cross-subdomain same parent) / Strict for portal where applicable
- **Session table**: stores hashed refresh token, user/portal account, expiry, revoke flag
- **Refresh rotation**: each refresh invalidates previous refresh token
- **Revoke**: single session or all sessions
- **Audiences**: `internal` (team users) vs `portal` (customer accounts)
- Tokens are **never** stored in localStorage

## 5. Authorization (RBAC)

Every protected API:

1. `requireAuth` — validates cookie JWT + active session
2. `requirePermission('resource:action')` — role→permission check
3. Resource scoping — e.g. Editor/Narrator see only assigned projects; Customer only own `customerId`

Frontend button hiding is cosmetic only.

## 6. Module Boundaries

| Module | Owns |
|--------|------|
| auth | login, refresh, logout, sessions, OTP helpers |
| crm | customers, opportunities |
| portal | invites, registration, customer dashboard APIs |
| projects | project CRUD, status, brief, assignments, files |
| content | versions, approvals, feedback, revision counters |
| ai | agents, ai_runs, context builders |
| production | narrator/editor uploads, prompt logs, QC |
| finance | invoices, payments, expenses, payables, profit |
| delivery | download permissions, signed URLs |
| portfolio | drafts, publish, success story |
| public | services, styles, samples, published portfolio |
| settings | WhatsApp, terms, catalog, storage config |
| notifications | in-app notifications |
| audit | immutable audit_logs |

## 7. Project Auto-Create Transaction (§9)

On customer brief submit (single DB transaction):

1. Create Project (`New / Manager Review`)
2. Link customer, opportunity, portal account, manager
3. Create Client Asset references + order files
4. Create Project Context (JSON + Markdown)
5. Create Finance account; attach prior deposit invoice/payment
6. Proposed narrator assignment
7. Timeline event + manager notification
8. CRM stage → `Project Created`

## 8. Content & Production Pipeline

```
Generate Content → Content Version (Scenario/Narration/Storyboard)
→ Manager Approve for Client → Portal publish
→ Client Approve / Feedback (max 2 + manager Extra Revision)
→ Lock narration → Narrator Assignment → Accept audio
→ Editor Production (watermarked + clean + prompt log + used assets)
→ Manager Final Review → Client Final Approve
→ Waiting Payment / Ready to Download → Complete → Portfolio Draft
```

## 9. Security Stack

- Helmet, CORS whitelist, rate limiting, CSRF double-submit for mutating cookie sessions
- bcrypt password hashing
- Input validation on every write
- Signed temporary download URLs with revoke
- Soft delete on domain entities; immutable finance/approval/audit rows
- Customer cannot escalate via URL ID change

## 10. Localization & UX

- Primary UI: Dari (Afghanistan) only — RTL always (`lang="fa-AF"`, `dir="rtl"`)
- Numbers, emails, and URLs use LTR isolation where needed for readability
- Internal: desktop-first; Portal/Public: mobile-first
- Loading skeletons, empty/error states, Framer Motion for presence

## 11. Deployment Topology

Local or VPS: PostgreSQL + Node API + Next.js web behind Nginx/Caddy HTTPS. Media files are stored in **Cloudinary** (development/testing) or **Cloudflare R2 / S3** (production) — no local disk uploads. Staging and production environments are separated; all accounts owned by Apex.
