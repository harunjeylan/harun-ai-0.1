# AGENTS.md - Agent Coding Guidelines

This file provides guidance for AI agents working in this codebase.

## Project Overview

**HarunAI** - Personal AI Operations System (CLI, multi-agent, workflow-driven).
- Runtime: Bun (ES modules, TypeScript)
- Main entry: `src/main.ts`
- Built with `@mariozechner/pi-*` packages (pi-agent-core, pi-ai, pi-tui)

---

## Commands

### Development
```bash
bun install              # Install dependencies
bun run dev             # Start in TUI mode
bun run tui             # Alias for dev
```

### Build & Run
```bash
bun run build           # Compile to dist/ (Bun binary)
bun run start           # Run compiled binary
```

### Type Checking
```bash
bun run typecheck       # Run TypeScript type check (tsc --noEmit)
```

### No Test Framework
This project currently has **no test suite**. Do not write tests unless explicitly requested.

---

## Code Style Guidelines

### General
- **Language**: TypeScript (strict mode enabled)
- **Module System**: ES Modules with explicit `` extensions in imports
- **Runtime**: Bun (ES2022 target)

### Formatting & Imports
- Use named exports only (no default exports unless from external packages)
- Import paths must include `` extension: `import { foo } from "./bar";`
- Order imports: external packages → internal modules → relative paths
- Use explicit type imports: `import type { Foo } from "./bar";`

### Naming Conventions
- **Files**: kebab-case (e.g., `workflow-engine.ts`)
- **Classes**: PascalCase (e.g., `class Assistant`)
- **Functions/Variables**: camelCase (e.g., `function getArg()`, `const apiKey`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `const DEFAULT_TIMEOUT_MS`)
- **Interfaces/Types**: PascalCase (e.g., `interface Registry`)

### TypeScript Rules
- `strict: true` is enabled in tsconfigon
- Always declare return types for exported functions
- Use `any` sparingly; prefer explicit types
- Use `type` for simple type aliases, `interface` for object shapes

### Error Handling
- Use try/catch with async/await
- Log errors to stderr with descriptive messages
- Exit with `process.exit(1)` on fatal errors
- Example:
  ```typescript
  main().catch((err) => {
    process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
  ```

### Patterns

#### Class Dependencies (Dependency Injection)
```typescript
export class Assistant {
  constructor(private readonly deps: { registry: Registry; runtime: ToolRuntime }) {}
}
```

#### Tool Definitions (pi-agent-core)
```typescript
const myTool: AgentTool = {
  name: "tool_name",
  label: "Tool Label",
  description: "What it does.",
  parameters: Type.Object({ /* Zod-like schema */ }),
  async execute(toolCallId, params) {
    void toolCallId;
    // ...
    return { content: [{ type: "text", text: "result" }], details: {} };
  },
};
```

#### Environment Variables
- Access via `process.env.VAR_NAME`
- Use sensible defaults: `Number(process.env.HARUNAI_TIMEOUT_MS ?? "45000")`
- Never hardcode API keys; require them via env vars

---

## Project Structure

```
src/
├── main.ts              # CLI entry point
├── core/
│   ├── assistant.ts    # Main assistant agent
│   ├── registry.ts     # Registry interface
│   ├── app.ts          # App bootstrap
│   └── scheduler.ts    # Workflow scheduler
├── registry/
│   ├── default-registry.ts
│   └── file-loader.ts
├── tools/              # Tool implementations
├── ui/                 # UI utilities (chat, theme)
└── tui/                # Terminal UI integration
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HARUNAI_PROVIDER` | LLM provider fallback (openai, openrouter, anthropic, google) |
| `HARUNHARUNAI_PROVIDER` | LLM provider (primary, takes precedence over HARUNAI_PROVIDER) |
| `HARUNAI_MODEL` | OpenRouter model ID |
| `HARUNAI_MODEL` | Model ID (fallback when not using OpenRouter) |
| `OPENAI_API_KEY` | OpenAI API key |
| `HARUNAI_API_KEY` | OpenRouter API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `HARUNAI_TIMEOUT_MS` | Assistant timeout in ms (default: 45000) |
| `OPENROUTER_HTTP_REFERER` | OpenRouter HTTP Referer header |
| `OPENROUTER_X_TITLE` | OpenRouter X-Title header |
| `OPENROUTER_BASE_URL` | OpenRouter base URL override |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for send_telegram tool |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for send_telegram tool |

---

## Key Dependencies

- `@mariozechner/pi-agent-core` - Agent runtime
- `@mariozechner/pi-ai` - LLM providers
- `@mariozechner/pi-tui` - Terminal UI
- `chalk` - Terminal colors
- `zod` - Validation schemas
- `pdf-lib` - PDF generation
- `dotenv` - Env file loading

---

## Notes

- Outputs are written to `./outputs/`
- User templates referenced via `skills/` and `rules/` directories
- No linting or formatting tools configured; follow existing code style
