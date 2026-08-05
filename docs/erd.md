# APEX Workspace — Entity Relationship Diagram

## Overview ERD

```mermaid
erDiagram
  Role ||--o{ User : has
  Role ||--o{ RolePermission : maps
  Permission ||--o{ RolePermission : maps
  User ||--o{ Session : owns
  User ||--o{ AuditLog : writes
  User ||--o{ Notification : receives

  CrmCustomer ||--o{ Opportunity : has
  CrmCustomer ||--o| PortalAccount : "0..1"
  CrmCustomer ||--o{ ClientAsset : owns
  CrmCustomer ||--o{ Project : has
  CrmCustomer ||--o{ Invoice : billed

  PortalAccount ||--o{ Session : portal_sessions
  PortalAccount ||--o{ PortalInvite : invites
  PortalInvite ||--o{ OtpCode : otp

  Opportunity ||--o| Project : "finalized 1:1"
  Opportunity ||--o{ Invoice : deposit

  Project ||--|| ProjectContext : context
  Project ||--|| ProjectFinance : finance
  Project ||--o{ ProjectAssignment : team
  Project ||--o{ ProjectFile : files
  Project ||--o{ AssetReference : refs
  Project ||--o{ ContentVersion : versions
  Project ||--o{ Approval : approvals
  Project ||--o{ ClientFeedback : feedback
  Project ||--o{ AiRun : runs
  Project ||--o| DownloadPermission : download
  Project ||--o| PortfolioItem : portfolio
  Project ||--o{ EmployeePayable : payables

  ContentVersion ||--o{ Approval : linked
  ContentVersion ||--o{ ClientFeedback : linked
  Invoice ||--o{ InvoiceItem : lines
  Invoice ||--o{ Payment : payments
  TeamProfile ||--o{ Rate : rates
  TeamProfile ||--o{ AudioSample : samples
  Service ||--o{ Style : styles
```

## Critical Relations (§22.1)

| Relation | Cardinality | Rule |
|----------|-------------|------|
| CrmCustomer → Opportunities | 1:N | All sales requests |
| CrmCustomer → Projects | 1:N | After deposit + brief |
| CrmCustomer → PortalAccount | 0..1 : 1 | Only finalized customers |
| PortalAccount.normalizedWhatsapp | Unique | P-03 |
| Opportunity → Project | 0..1 : 1 | Only confirmed + brief submitted |
| Project → ContentVersions | 1:N | Never overwrite |
| Project → PortfolioItem | 0..1 | Draft/Published |
| Project → ProjectFinance | 1:1 | Auto-created |

## Enums (key)

**CrmPipelineStage:** NEW_LEAD, CONTACTED, INTERESTED, PRICE_SENT, ORDER_CONFIRMED, COMPLETED, CANCELED

**PortalStatus:** NOT_ELIGIBLE, ELIGIBLE, INVITED, REGISTERED, SUSPENDED

**ProjectStatus:** NEW_MANAGER_REVIEW, CONTENT_GENERATION, INTERNAL_CONTENT_REVIEW, WAITING_CLIENT_CONTENT_APPROVAL, CONTENT_REVISION, NARRATION_RECORDING, PRODUCTION_EDITING, MANAGER_FINAL_REVIEW, FINAL_REVISION, WAITING_CLIENT_FINAL_APPROVAL, WAITING_PAYMENT, READY_TO_DOWNLOAD, COMPLETED, ON_HOLD, CANCELED

**CustomerFacingStatus:** INFO_RECEIVED, PREPARING_CONTENT, WAITING_YOUR_APPROVAL, IN_PRODUCTION, FINAL_REVIEW, WAITING_PAYMENT, READY_DELIVERY, COMPLETED

**InvoiceStatus:** DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELED

**PayableStatus:** ESTIMATED, CONFIRMED, PAID

**AiAgentType:** SCENARIO, NARRATION, STORYBOARD

**PortfolioPermission:** ALLOWED, NOT_ALLOWED, HIDE_CLIENT_NAME, PENDING

**PortfolioStatus:** DRAFT, PUBLISHED, UNPUBLISHED

## Soft Delete Strategy

- Soft `deletedAt` on: users, crm_customers, opportunities, projects, client_assets, services, styles, team_profiles, portfolio_items (draft), notifications
- **Never hard/soft-delete:** invoices, payments, approvals, audit_logs, download history events (revoke flags instead)

## Indexes

- `crm_customers.normalized_whatsapp` UNIQUE
- `portal_accounts.normalized_whatsapp` UNIQUE
- `portal_invites.token` UNIQUE
- `opportunities.pipeline_stage`
- `projects.status`, `projects.code` UNIQUE
- `sessions.refresh_token_hash`
- `ai_runs.project_id + created_at`
- `content_versions.project_id + version_number`
