import chalk from "chalk";
import { Type, getModel, getModels, getProviders } from "@mariozechner/pi-ai";
import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import type { Registry } from "../core/registry.js";
import { createToolRuntime } from "../core/runtime/tools.js";

export function listPiProviders(): string[] {
  return getProviders();
}

export function listPiModels(provider: string): string[] {
  const models = getModels(provider as never);
  return models.map((m) => m.id);
}

export async function runPiChat(opts: {
  provider: string;
  modelId: string;
  text: string;
  registry: Registry;
}) {
  const model = getModel(opts.provider as never, opts.modelId as never);
  const runtime = createToolRuntime(opts.registry);
  const tools = createHarunToolsForPi(runtime);

  const agent = new Agent();
  agent.setSystemPrompt(
    [
      "You are HarunAI (MVP).",
      "Use tools when needed. Keep outputs concise.",
    ].join("\n"),
  );
  agent.setModel(model);
  agent.setTools(tools);

  const unsubscribe = agent.subscribe((e) => {
    if (e.type === "message_update") {
      const ev = e.assistantMessageEvent;
      if (ev.type === "text_delta") process.stdout.write(ev.delta);
      if (ev.type === "thinking_delta") process.stdout.write(chalk.gray(ev.delta));
      if (ev.type === "error")
        process.stdout.write(
          chalk.red(`\n[pi-ai error] ${ev.error.errorMessage ?? "Unknown error"}\n`),
        );
      if (ev.type === "done") process.stdout.write("\n");
    }
  });

  try {
    await agent.prompt(opts.text);
    await agent.waitForIdle();
  } finally {
    unsubscribe();
  }
}

function createHarunToolsForPi(runtime: ReturnType<typeof createToolRuntime>): AgentTool[] {
  return [
    {
      name: "write_markdown",
      label: "Write Markdown",
      description: "Write a markdown output file to outputs/.",
      parameters: Type.Object({
        topic: Type.Optional(Type.String()),
        template: Type.Optional(Type.String()),
      }),
      async execute(toolCallId, params) {
        void toolCallId;
        await runtime.invoke("write_markdown", params as Record<string, unknown>);
        return { content: [{ type: "text", text: "Wrote markdown." }], details: {} };
      },
    },
    {
      name: "render_pdf",
      label: "Render PDF",
      description: "Render a PDF (placeholder) from the latest markdown output.",
      parameters: Type.Object({
        mdPath: Type.Optional(Type.String()),
      }),
      async execute(toolCallId, params) {
        void toolCallId;
        await runtime.invoke("render_pdf", params as Record<string, unknown>);
        return { content: [{ type: "text", text: "Rendered PDF (placeholder)." }], details: {} };
      },
    },
    {
      name: "send_telegram",
      label: "Send Telegram",
      description: "Stub: print what would be sent to Telegram.",
      parameters: Type.Object({
        message: Type.Optional(Type.String()),
      }),
      async execute(toolCallId, params) {
        void toolCallId;
        await runtime.invoke("send_telegram", params as Record<string, unknown>);
        return { content: [{ type: "text", text: "Sent Telegram (stub)." }], details: {} };
      },
    },
  ];
}
