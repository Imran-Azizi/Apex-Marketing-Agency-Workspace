# APEX Workspace — UI Wireframe Plan

## Design System

- Enterprise SaaS: dense but calm, clear hierarchy, shadcn/ui consistently
- Colors: brand CSS variables (deep teal/slate — avoid generic purple/cream AI clichés)
- Typography: purposeful Persian-capable fonts (e.g. Vazirmatn) + Latin dual stacking
- Motion: 2–3 intentional Framer Motion patterns (page fade, sidebar, dialog)
- States: skeleton, empty, error on every data view

## Layout Patterns

### A. Public (SEO, mobile-first)

```
┌────────────────────────────┐
│ Header: Logo | Services | Portfolio | CTA WhatsApp │
├────────────────────────────┤
│ Hero brand + one headline  │
│ one supporting line + CTA  │
├────────────────────────────┤
│ Service cards / Portfolio grid │
└────────────────────────────┘
```

### B. Internal Dashboard (desktop-first)

```
┌──────┬───────────────────────────────────┐
│ Logo │ Topbar: search, notif, user       │
│ Nav  ├───────────────────────────────────┤
│ Dash │ Page title + filters + actions    │
│ CRM  │                                   │
│ Proj │ Main content: table/board/charts  │
│ Fin  │                                   │
│ Team │                                   │
│ Port │                                   │
│ Set  │                                   │
└──────┴───────────────────────────────────┘
```

### C. Customer Portal (mobile-first)

```
┌────────────────────────────┐
│ Brand | Project status chips│
├────────────────────────────┤
│ Active projects cards      │
│ Pending approvals          │
│ Invoices / Balance         │
│ Downloads (gated)          │
│ New Order | Contact WA     │
└────────────────────────────┘
```

## Page Inventory

### Public
1. Home / Services
2. Video Styles
3. Narrator Samples
4. Portfolio List (filters)
5. Portfolio Detail + WA CTA

### Auth
6. Internal Login
7. Portal Invite Landing
8. OTP + Password Create
9. Portal Login / Forgot Password

### Internal
10. Manager Dashboard (queues §21.1)
11. CRM Pipeline Board
12. CRM Customer List
13. Customer Profile (timeline, assets, opps)
14. Opportunity Detail + Invite gate
15. Projects Board / List
16. Project Detail tabs: Overview | Brief | Content | Voice | Production | Review | Finance | Portfolio | Activity
17. AI Assistant panel (project-scoped)
18. Finance Dashboard / Invoices / Payments / Payables / Expenses
19. Team: Editors, Narrators, Rates, Samples
20. Portfolio Manager Drafts
21. Settings (services, WhatsApp, terms, storage)
22. Notifications, Audit Log

### Portal
23. Portal Dashboard
24. Project Status (customer-facing stages only)
25. Content Approval
26. Final Video Review
27. Invoices & Payments
28. Final Files / Download
29. New Order Request
30. Profile
31. Contact Manager WhatsApp

## Project Tab Wireframes (critical)

**Content:** version selector | Scenario scenes | Narration | Storyboard | Approve for Client / Regenerate  
**Voice:** locked text | assignment | audio player | Accept / Re-record  
**Production:** Prompt Log | Used Assets | Working | Watermarked | Clean | Submit Review  
**Review:** QC report | Client feedback history | Publish watermarked  
**Finance:** Final price | Received | Balance | Costs | Profit (role-gated)  
**Portfolio:** Permission | Create Draft | Success Story | Publish

## Empty / Loading / Error

- Empty: illustration + single CTA (e.g. "ثبت سرنخ جدید")
- Loading: shadcn Skeleton matching layout
- Error: message + retry; never expose stack traces

## Responsive Breakpoints

- Public/Portal: base mobile → md tablet → lg desktop
- Internal: min usable tablet; primary lg+ with persistent sidebar
