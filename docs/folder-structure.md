# APEX Workspace — Folder Structure

```
APEX_SYSTEM_PROJECT/
├── docs/
│   ├── architecture.md
│   ├── erd.md
│   ├── permission-matrix.md
│   ├── api-specification.md
│   ├── folder-structure.md
│   ├── ui-wireframe-plan.md
│   └── development-roadmap.md
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.js
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── app.js
│   │   │   ├── config/
│   │   │   │   ├── env.js
│   │   │   │   └── cookies.js
│   │   │   ├── db/
│   │   │   │   └── prisma.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js
│   │   │   │   ├── rbac.js
│   │   │   │   ├── csrf.js
│   │   │   │   ├── rateLimit.js
│   │   │   │   ├── errorHandler.js
│   │   │   │   ├── audit.js
│   │   │   │   └── validate.js
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── crm/
│   │   │   │   ├── portal/
│   │   │   │   ├── projects/
│   │   │   │   ├── content/
│   │   │   │   ├── ai/
│   │   │   │   ├── production/
│   │   │   │   ├── finance/
│   │   │   │   ├── delivery/
│   │   │   │   ├── portfolio/
│   │   │   │   ├── public/
│   │   │   │   ├── team/
│   │   │   │   ├── settings/
│   │   │   │   ├── notifications/
│   │   │   │   ├── audit/
│   │   │   │   └── files/
│   │   │   ├── services/
│   │   │   │   ├── storage.js
│   │   │   │   ├── aiProvider.js
│   │   │   │   ├── whatsapp.js
│   │   │   │   └── projectContext.js
│   │   │   └── utils/
│   │   │       ├── whatsappNormalize.js
│   │   │       ├── tokens.js
│   │   │       ├── passwords.js
│   │   │       └── response.js
│   │   └── tests/
│   │       └── acceptance/
│   └── web/
│       ├── package.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── components.json
│       ├── app/
│       │   ├── layout.tsx            # RTL fa-AF
│       │   ├── (public)/
│       │   ├── (auth)/
│       │   ├── (dashboard)/
│       │   └── (portal)/
│       ├── components/
│       │   ├── ui/              # shadcn
│       │   ├── layout/
│       │   └── shared/
│       └── lib/
│           ├── api.ts
│           ├── auth.ts
│           └── utils.ts
├── .env.example
├── package.json                 # workspace root scripts
└── README.md                    # Dari Persian
```

Each backend module folder contains:

```
routes.js
controller.js
service.js
validators.js
```
