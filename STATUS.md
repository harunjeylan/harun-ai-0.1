## Project Status — HarunAI

**Date**: 2026-03-17  
**Version**: 0.1.0 (active development)  
**Primary goal**: Ship a usable TUI-first MVP that can generate real artifacts (Markdown/PDF) via workflows + tools.

### Current State (What works)
- **TUI entrypoint + CLI bin**: `harunai` launches the terminal UI (`src/main.ts` + `src/tui/`).
- **Assistant orchestration**: Provider/model resolved via env (`HARUNAI_PROVIDER`, `HARUNAI_MODEL`) with API-key detection and better runtime error messaging.
- **Tool/runtime wiring**: Tools are registered through a runtime layer and exposed to the agent (`write_markdown`, `render_template_markdown`, `render_pdf`, `send_telegram`).
- **Artifact outputs**: Generated files land in `outputs/` and latest artifacts are tracked for follow-on steps.

### Recently Completed
- **Refactor away from legacy CLI entry**: removed old `src/cli.ts` flow; consolidated around `src/main.ts` and TUI.
- **Template-based document generation**: added `render_template_markdown` to render `templates/*.md` with simple `{{placeholders}}`.
- **Improved PDF + Telegram tooling**: PDF rendering flow expanded; Telegram tool moved closer to a real integration (vs. only a stub).
- **Registry/workflow improvements**: default registry updates to better expose workflows/tools to the assistant runtime.

### In Progress / Next Up (Near-term)
- **Make `render_pdf` non-placeholder end-to-end**: ensure a predictable “Markdown → PDF” pipeline, with clear input selection and output naming.
- **Harden tool UX**: better validation + friendlier prompts when template paths, required env vars, or artifacts are missing.
- **Workflow library**: add 2–4 “golden path” workflows (proposal generation, daily briefing, report packaging, delivery).
- **Docs**: consolidate “how to use” across `README.md`, templates, skills, and rules; add examples per tool/workflow.

### Risks / Watch-outs
- **Provider drift**: model IDs and provider-specific quirks vary (OpenRouter headers, base URLs, tool streaming differences).
- **Output correctness**: template placeholder rendering is intentionally simple; complex documents may need a richer templating strategy.
- **Distribution boundaries**: sending outputs (Telegram/email/drive) needs careful secret handling and safe defaults.

### Decisions / Conventions
- **TUI-first**: prioritize an interactive terminal workflow over a traditional flags-based CLI.
- **File-based outputs**: artifacts are written to `outputs/` so downstream steps can compose (PDF conversion, sending, archiving).
- **Prefer user-owned templates**: documents should come from `templates/` rather than hard-coded strings in tools.

### Quick Commands
```bash
bun install
cp .env.example .env
bun run dev
```

