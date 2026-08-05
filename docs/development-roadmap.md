# APEX Workspace — Development Roadmap

Aligned to Specification §25 and user build phases.

## Phase 0 — UX & Architecture ✅ (docs/)

- [x] Architecture document
- [x] ERD
- [x] Permission matrix
- [x] API specification
- [x] Folder structure
- [x] UI wireframe plan
- [x] This roadmap + AC checklist

## Phase 1 — Core Auth + RBAC ✅

- [x] Prisma schema + seed
- [x] JWT HTTP-only cookies, refresh rotation, session revoke
- [x] Roles/permissions middleware
- [x] Settings, audit, notifications backbone
- [x] Storage adapter (local / S3-compatible)

## Phase 2 — Public Website ✅

- [x] Services, styles, narrator samples, portfolio list/detail
- [x] WhatsApp CTA from Settings (AC-02)

## Phase 3 — CRM & Sales ✅

- [x] Pipeline stages exact (§5.2)
- [x] Duplicate WhatsApp prevention (AC-01)
- [x] Opportunity, invoice/payment, simplified invite eligibility (phone + order confirmed + accepted terms)

## Phase 4 — Customer Portal ✅

- [x] Invite/OTP/register (AC-05, AC-06)
- [x] Dashboard scoped data (AC-18)
- [x] New order → Opportunity only (AC-23)

## Phase 5 — Projects & Agents ✅

- [x] Auto project create transaction (AC-07, AC-08)
- [x] Content versions + AI runs (AC-09–AC-14)

## Phase 6 — Production ✅

- [x] Narrator/Editor/QC workflows (AC-15–AC-17)

## Phase 7 — Finance & Delivery ✅

- [x] Multi-payment balance (AC-19)
- [x] Download gates (AC-20–AC-22)

## Phase 8 — Portfolio Automation ✅

- [x] Draft transfer, agent story, publish (AC-24–AC-26)

## Phase 9 — QA & Launch ✅

- [x] Acceptance unit tests (core formulas + gates)
- [x] Optional integration workflow test (`RUN_INTEGRATION=1`)
- [x] README Dari, local/VPS deploy notes, `.env.example`

---

## Acceptance Criteria Checklist

| ID | Scenario | Status |
|----|----------|--------|
| AC-01 | New lead → CRM only | Implemented + integration test |
| AC-02 | Public CTA → WhatsApp | Implemented + integration test |
| AC-03 | Invite before terms/order confirmation disabled | Implemented — phone + order + terms gates |
| AC-04 | Eligible customer → invite OK | Implemented — simplified eligibility UI |
| AC-05 | Wrong number on invite rejected | Implemented (invite binds WhatsApp) |
| AC-06 | Repeat customer no new account | Implemented |
| AC-07 | Brief submit auto-creates project stack | Implemented + portal brief UI |
| AC-08 | Client Assets reference, no duplicate | Implemented — ClientAsset API |
| AC-09 | Generate Content auto project ID | Implemented + project action UI |
| AC-10 | AI output → versioned Scenario/Narration/Storyboard | Implemented |
| AC-11 | Client cannot see drafts pre-manager approve | Implemented |
| AC-12 | Client revision → feedback + counter + new version | Implemented |
| AC-13 | >2 revisions locked; Extra Revision manager | Unit tested + UI |
| AC-14 | Content approve locks narration + assignment | Implemented |
| AC-15 | Narrator upload attaches to project | Implemented |
| AC-16 | Editor dual finals + prompt log + used assets | Implemented + production UI |
| AC-17 | QC/Manager reject → editor revision | Implemented + review UI |
| AC-18 | Portal shows only allowed data | Implemented + mapping unit test |
| AC-19 | Multiple payments update balance/invoice | Unit tested formula |
| AC-20 | Balance > 0 hides clean download | Unit tested + portal download UI |
| AC-21 | Settled without allow stays locked | Unit tested |
| AC-22 | Settled + allow → signed clean URL | Implemented |
| AC-23 | New order → Opportunity not Project | Implemented + integration test |
| AC-24 | Portfolio NOT_ALLOWED blocks create/publish | Implemented + PENDING blocks publish |
| AC-25 | Create Portfolio Draft auto-transfers media/meta | Implemented + UI |
| AC-26 | Portfolio draft from completed projects; no auto-publish | Implemented |
| AC-27 | Editor/Narrator cannot see price/profit/others | Implemented (stripFinance) |
| AC-28 | Sensitive ops audited | Implemented (writeAudit) |

### Gap closure (2026-07-16)

Operational UIs and hardened gates were completed against Spec v3.0: CRM invite eligibility, merge duplicates, Client Assets, forgot-password OTP, portal brief form, project workflow actions, public narrators/filters, settings edit, invoice HTML PDF.
