# APEX Workspace — Permission Matrix

Legend: **F** = Full | **R** = Read | **W** = Write | **Own** = Own/assigned only | **—** = Denied

## Roles

| Role | Code |
|------|------|
| CEO / Manager | `MANAGER` |
| Sales | `SALES` |
| Editor | `EDITOR` |
| Narrator | `NARRATOR` |
| Finance | `FINANCE` |
| Customer | `CUSTOMER` |
| AI Service | `AI_SERVICE` |

## Matrix

| Resource:Action | Manager | Sales | Editor | Narrator | Finance | Customer | AI |
|-----------------|---------|-------|--------|----------|---------|----------|-----|
| dashboard:view | F | R | Own | Own | R | R | — |
| crm:read | F | F | — | — | R | — | — |
| crm:write | F | F | — | — | — | — | — |
| crm:merge | F | F* | — | — | — | — | — |
| opportunity:manage | F | F | — | — | R | — | — |
| portal_invite:create | F | F† | — | — | — | — | — |
| project:read | F | R | Own | Own | R‡ | Own | R§ |
| project:write | F | — | Own¶ | Own# | — | Brief | — |
| content:generate | F | — | — | — | — | — | W |
| content:approve_internal | F | — | — | — | — | — | — |
| content:approve_client | — | — | — | — | — | Own | — |
| narration:assign | F | — | — | — | — | — | — |
| voice:upload | F | — | — | Own | — | — | — |
| production:upload | F | — | Own | — | — | — | — |
| finance:read | F | Limited | — | — | F | Own** | — |
| finance:write | F | Deposit | — | — | F | — | — |
| download:allow | F | — | — | — | F | — | — |
| download:clean | — | — | — | — | — | Own†† | — |
| portfolio:manage | F | — | — | — | — | — | Draft |
| settings:manage | F | — | — | — | — | — | — |
| team:manage | F | — | — | Own profile | R pay | — | — |
| audit:read | F | — | — | — | R | — | — |
| ai:run | F | Sales agent | — | — | — | — | F |

\* Merge duplicate: Manager + senior sales  
† Only when deposit verified + order confirmed  
‡ Finance: prices/invoices, not creative drafts  
§ AI reads allowed project context only  
¶ Editor: production fields on assigned projects  
# Narrator: voice upload on assigned projects  
\*\* Customer sees invoices/payments/balance — never costs/profit  
†† Clean download requires balance=0 AND allow flag  

## Special Rules

1. **AI Service** may create versioned outputs and draft success stories; may NOT publish, approve, delete files, or mutate finance (P-08).
2. **Customer** never sees internal stages, prompts, raw working files, costs, profit, or other customers (AC-18).
3. **Editor/Narrator** never see sales price, profit, or unassigned projects (AC-27).
4. **Sales** sees proposed prices and deposit invoices; total company profit requires Manager/Finance unless explicitly granted.
5. **Allow Download Override** when balance > 0: Manager only, with mandatory reason + audit (AC-28).

## Permission Codes (seed)

```
dashboard:view
crm:read crm:write crm:merge
opportunity:manage
portal_invite:create
project:read project:write project:start
content:generate content:approve_internal content:approve_client
narration:assign voice:upload
production:upload production:submit
finance:read finance:write
download:allow download:clean
portfolio:manage portfolio:publish
settings:manage
team:manage
audit:read
ai:run
notification:read
```
