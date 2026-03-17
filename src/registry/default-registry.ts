import { Registry } from "../core/registry.js";

export function createDefaultRegistry(): Registry {
  const r = new Registry();

  // Tools
  r.registerTool({
    name: "write_markdown",
    description: "Write a markdown output file to outputs/.",
  });

  r.registerTool({
    name: "render_template_markdown",
    description: "Render a markdown file from a user-provided template and data.",
  });

  r.registerTool({
    name: "render_pdf",
    description: "Render a basic PDF from text to outputs/.",
  });

  r.registerTool({
    name: "send_telegram",
    description: "Stub: print what would be sent to Telegram.",
  });

  // Agents (conceptual in this MVP)
  r.registerAgent({
    name: "assistant",
    description: "Orchestrator agent",
    tools: [],
  });

  r.registerAgent({
    name: "proposal_agent",
    description: "Creates proposals",
    tools: ["write_markdown", "render_pdf"],
  });

  r.registerAgent({
    name: "distribution_agent",
    description: "Distributes outputs",
    tools: ["send_telegram"],
  });

  // Workflows
  r.registerWorkflow({
    name: "proposal_delivery",
    description: "Generate proposal, export PDF, send via Telegram (stub).",
    steps: [
      {
        id: "generate_md",
        tool: "render_template_markdown",
        input: { templatePath: "templates/proposal.md", prefix: "proposal" },
      },
      { id: "pdf", tool: "render_pdf", input: {} },
      {
        id: "notify",
        tool: "send_telegram",
        input: {
          message: "Proposal delivered.",
        },
      },
    ],
  });

  r.registerWorkflow({
    name: "ai_news_daily",
    description: "Stub workflow: would fetch, summarize, narrate, distribute.",
    steps: [
      {
        id: "notify",
        tool: "send_telegram",
        input: { message: "AI news daily is not implemented yet." },
      },
    ],
  });

  return r;
}
