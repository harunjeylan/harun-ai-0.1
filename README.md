# 🧠 Project Overview

## **HarunAI — Personal AI Operations System**

---

## Quickstart (MVP)

Prereqs: Bun (recommended) + Node.js (for `tsc` typecheck).

```bash
bun install
cp .env.example .env
bun run dev
```

Try:

```text
> /list workflows
> Create proposal for bus subscription platform
> /run proposal_delivery
> /schedule ai_news_daily "*/10 * * * *"
```

Outputs are written to `./outputs/`.

## Agentic Toolkit (pi-*)

This repo includes Mario Zechner's `pi-*` packages for multi-provider models + agent runtime:

- `@mariozechner/pi-ai` (providers + model registry)
- `@mariozechner/pi-agent-core` (agent runtime + tool calling)
- `@mariozechner/pi-coding-agent` (binary: `pi`)
- `@mariozechner/pi-mom` (binary: `mom`)
- `@mariozechner/pi-tui` (terminal UI)

From inside the HarunAI CLI:

```text
> /pi providers
> /pi models openai
> Create proposal for bus subscription platform and deliver it
```

`ask` requires the relevant API key in your environment (example: `OPENAI_API_KEY`).

### Integration Note

The pi agent runtime is now part of the main system path:

`CLI → Assistant Agent (pi-agent-core) → run_workflow/tools → outputs`

## OpenRouter + DeepSeek (test)

Set env vars then run `bun run dev`:

```bash
export HARUNAI_PROVIDER=openrouter
export HARUNAI_MODEL=deepseek/deepseek-chat-v3.1
export OPENROUTER_API_KEY="..."
```

Optional (recommended by OpenRouter):

```bash
export OPENROUTER_HTTP_REFERER="http://localhost"
export OPENROUTER_X_TITLE="HarunAI"
```

## 1. Vision

HarunAI is a **CLI-based personal AI system** designed to automate and enhance professional daily operations for a system engineer.

It is not just an assistant, but:

> **An operational intelligence system that can design, execute, and automate workflows.**

---

## 2. Core Objective

To build a system that allows the user to:

* interact with AI through a CLI
* delegate tasks to specialized agents
* dynamically create agents, tools, and workflows
* automate multi-step tasks
* schedule recurring operations
* generate real-world outputs (PDF, PPT, audio, etc.)

---

## 3. Key Capabilities

### 3.1 Conversational Command Interface

User interacts via CLI:

```
harunai
> create proposal for bus subscription platform
```

The system interprets and executes tasks.

---

### 3.2 Multi-Agent System

System consists of:

#### Assistant Agent (Orchestrator)

* understands user intent
* plans tasks
* delegates to worker agents
* manages system capabilities

---

#### Worker Agents (Specialized)

Examples:

* proposal_agent
* research_agent
* document_agent
* media_agent
* distribution_agent

Each agent has:

* skills (reasoning patterns)
* tools (execution capabilities)
* knowledge (data sources)

---

### 3.3 Dynamic Agent Builder

The system can create new agents on demand.

Example:

```
> create agent for writing SRS documents
```

System:

* generates agent structure
* assigns skills and tools
* registers agent

---

### 3.4 Workflow System

Tasks are executed as workflows.

Example workflow:

```
1. generate proposal
2. convert to PDF
3. generate PPT
4. send via Telegram
```

Workflows can be:

* dynamically generated
* executed immediately
* saved for reuse

---

### 3.5 Workflow Persistence

Workflows can be stored as reusable templates.

Example:

```
> save this workflow as proposal_delivery
```

Later:

```
> run proposal_delivery
```

---

### 3.6 Scheduler (Automation)

Workflows can be scheduled.

Example:

```
> schedule ai_news_daily every morning at 7
```

System runs automatically without user interaction.

---

### 3.7 Knowledge & Context System

The system uses:

* templates (proposal, SRS, etc.)
* project files
* user-defined sources

To enhance outputs.

---

### 3.8 Real Output Generation

The system produces actual deliverables:

* `.md` documents
* `.pdf` files
* `.pptx` presentations
* `.mp3` audio
* sent messages (Telegram, email)

---

### 3.9 External Integration

The system integrates with:

* email services
* Telegram bot
* cloud storage (Drive/S3)
* web sources (RSS, YouTube, etc.)

---

## 4. Example Use Cases

---

### 4.1 Proposal Automation

```
> create proposal for Addis Ababa Islamic Affairs workflow system
```

System:

* generates proposal
* converts to PDF
* creates PPT
* sends via email

---

### 4.2 AI News Automation

```
> schedule daily AI news briefing
```

System:

* collects sources
* summarizes
* generates article
* creates audio
* sends via Telegram

---

### 4.3 System Design Assistance

```
> design workflow engine architecture
```

System:

* analyzes request
* generates architecture
* creates documentation

---

### 4.4 Agent Creation

```
> create agent specialized in Islamic finance systems
```

System builds and registers agent.

---

## 5. System Architecture

---

### 5.1 High-Level Architecture

```text
CLI Interface
   ↓
Assistant Agent (Orchestrator)
   ↓
Planner
   ↓
Workflow Engine
   ↓
Agent System
   ↓
Pi Runtime (Agent Execution)
   ↓
Tools
```

---

### 5.2 Core Components

---

#### 1. CLI Interface

* interactive terminal
* command input/output

---

#### 2. Assistant Agent

* intent understanding
* planning
* delegation

---

#### 3. Planner

* breaks request into steps
* builds workflow

---

#### 4. Workflow Engine

* executes step-by-step tasks
* manages data flow

---

#### 5. Agent Registry

* stores available agents
* resolves agent by name

---

#### 6. Tool Registry

* manages tools
* exposes capabilities to agents

---

#### 7. Scheduler

* runs workflows at defined times

---

#### 8. Knowledge System

* templates
* documents
* sources

---

#### 9. Pi Runtime Layer

Using:

* LLM interaction
* agent execution
* tool calling
* coding agent for dynamic creation

---

## 6. Directory Structure (Conceptual)

```
harunai/

  core/
    assistant.ts
    planner.ts
    workflow_engine.ts
    scheduler.ts

  registry/
    agents/
    tools/
    workflows/
    skills/

  runtime/
    pi_adapter.ts

  templates/
    proposal/

  outputs/
    proposals/
    reports/

  .harunai/
    (local project configs)
```

---

## 7. Design Principles

---

### 1. System First, Tools Second

Architecture is controlled by you, not frameworks.

---

### 2. File-Based Simplicity

Everything is stored as files:

* agents
* workflows
* templates

---

### 3. Dynamic Extensibility

System can create:

* agents
* tools
* workflows

---

### 4. Separation of Concerns

```
Agent → decides
Skill → thinks
Tool → executes
```

---

### 5. Incremental Complexity

Start simple:

* CLI
* 2 agents
* basic workflow

Then expand.

---

## 8. MVP Scope (Version 1)

---

### Must Have

* CLI interface
* assistant agent
* proposal agent
* workflow execution
* PDF generation
* basic scheduling

---

### Nice to Have

* agent builder
* Telegram integration
* PPT generation

---

## 9. Long-Term Vision

HarunAI evolves into:

* personal AI operating system
* organizational workflow engine
* AI system architect assistant

---

# 🚀 Final Summary

HarunAI is:

> **A CLI-based, multi-agent, workflow-driven AI system that automates professional operations and evolves dynamically through agent and workflow creation.**
