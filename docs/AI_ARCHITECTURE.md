# APEX AI Architecture — OpenRouter Content Production

## Stack

```
Manager UI (AI Workspace)
  → APEX API (/api/v1/ai)   [JWT + CSRF + aiLimiter]
  → services/ai/ai.service.js
  → provider factory (openrouter | openai | anthropic | gemini | mock)
  → ContentVersion · AiRun · AiWorkflowExecution · AiActivityLog
```

**No frontend LLM calls.** API keys stay on the backend only.

## Pipeline

```
Scenario → Narration → Storyboard
```

## Service layout

```
apps/api/src/services/ai/
  ├── ai.service.js            # orchestrator (runAgent, generatePipeline)
  ├── openrouter.service.js    # primary provider
  ├── openai.service.js
  ├── anthropic.service.js
  ├── gemini.service.js
  ├── mock.service.js
  ├── provider.factory.js
  ├── models.config.js
  ├── errors.js
  ├── validate.js
  └── prompts/
       ├── scenario.prompt.js
       ├── narration.prompt.js
       └── storyboard.prompt.js
```

Switch providers with `AI_PROVIDER` — no application rewrite required.

## Env (OpenRouter primary)

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_DEFAULT_MODEL=anthropic/claude-sonnet-4
AI_BACKUP_MODEL=openai/gpt-4o-mini
AI_ASYNC_PIPELINE=true
AI_ALLOW_MOCK_FALLBACK=false
AI_REQUEST_TIMEOUT_MS=120000
```

## Usage tracking

Each agent step writes an `AiRun` with:

- userId, agentType (feature), model, tokenUsage, status, error, durationMs, timestamps

## Security

- Keys never exposed to Next.js / browser
- Input sanitized before LLM calls
- `aiLimiter` on generate/regenerate
- Request timeouts via AbortController
