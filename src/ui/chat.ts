import {
  Box,
  CancellableLoader,
  CombinedAutocompleteProvider,
  type Component,
  Container,
  Editor,
  type Focusable,
  Key,
  Markdown,
  matchesKey,
  Spacer,
  type TUI as TuiType,
} from "@mariozechner/pi-tui";
import chalk from "chalk";
import {
  type ChatTheme,
  chatTheme,
  editorTheme,
  markdownTheme,
} from "./theme.js";
import type { Registry } from "../core/registry.js";
import type { Assistant } from "../agents/assistant.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool" | "delegation";
  content: string;
  toolName?: string;
  agentName?: string;
  timestamp: number;
}

export class ChatComponent implements Component, Focusable {
  private container: Container;
  private messagesBox: Box;
  private inputField: Editor;
  private spacer: Spacer;
  private loadingLoader?: CancellableLoader;
  private hint: Markdown;

  private messages: ChatMessage[] = [];
  private streamingContent = "";
  private streamingThinking = "";
  private currentToolCall: string | null = null;

  private tui: TuiType;
  private registry: Registry;
  private assistant?: Assistant;

  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    if (this.inputField) {
      this.inputField.focused = value;
    }
  }

  public onMessage?: (text: string) => void;
  public onExit?: () => void;

  constructor(
    tui: TuiType,
    registry: Registry,
    private tuiTheme: ChatTheme = chatTheme,
    assistant?: Assistant,
  ) {
    this.tui = tui;
    this.registry = registry;
    this.assistant = assistant;
    this.container = new Container();

    this.messagesBox = new Box(1, 0, (text) => chalk.bgGray.white(text));
    this.container.addChild(this.messagesBox);

    this.spacer = new Spacer(1);
    this.container.addChild(this.spacer);

    this.inputField = new Editor(this.tui, editorTheme as any, { paddingX: 1 });
    this.inputField.onSubmit = (text) => this.handleSubmit(text);
    this.inputField.setAutocompleteProvider(
      new CombinedAutocompleteProvider(
        [
          { name: "help", description: "Show help" },
          { name: "clear", description: "Clear chat history" },
          { name: "exit", description: "Exit the application" },
          { name: "tools", description: "List all tools" },
          { name: "agents", description: "List all agents" },
          { name: "workflows", description: "List all workflows" },
          { name: "inspect", description: "Inspect tool/agent/workflow" },
        ],
        process.cwd(),
      ),
    );
    this.container.addChild(this.inputField);

    this.hint = this.createHint();
    this.container.addChild(this.hint);

    this.addSystemMessage(
      "Welcome to HarunAI! Press Tab to switch agents. Use tools for file operations.",
    );
  }

  private createHint(): Markdown {
    const agentName = this.assistant?.getActiveAgent() ?? "assistant";
    const hintText = `Agent: ${agentName} | Tab: switch | Alt+Enter: new line | /help: commands`;
    return new Markdown(hintText, 1, 0, markdownTheme, {
      color: (t) => chalk.gray(t),
    });
  }

  private updateHint(): void {
    const index = this.container.children.indexOf(this.hint);
    if (index >= 0) {
      this.container.removeChild(this.hint);
    }
    this.hint = this.createHint();
    this.container.addChild(this.hint);
    this.requestRender();
  }

  private handleSubmit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("/")) {
      if (trimmed === "/exit" || trimmed === "/quit") {
        this.onExit?.();
        return;
      }
      if (trimmed === "/help") {
        this.addSystemMessage(
          "Commands:\n" +
            "/help - Show this help\n" +
            "/clear - Clear chat history\n" +
            "/exit - Exit the application\n" +
            "/tools - List all tools\n" +
            "/agents - List all agents\n" +
            "/workflows - List all workflows\n" +
            "/inspect <name> - Show details of a tool/agent/workflow",
        );
        this.requestRender();
        return;
      }
      if (trimmed === "/clear") {
        this.messages = [];
        while (this.messagesBox.children.length > 0) {
          this.messagesBox.removeChild(this.messagesBox.children[0]);
        }
        this.addSystemMessage("Chat history cleared.");
        this.requestRender();
        return;
      }
      if (trimmed === "/tools") {
        const tools = this.registry.listTools();
        let output = "**Available tools:**\n\n";
        for (const name of tools) {
          const spec = this.registry.getTool(name);
          output += `- **${name}**: ${spec?.description ?? "No description"}\n`;
        }
        this.addSystemMessage(output);
        this.requestRender();
        return;
      }
      if (trimmed === "/agents") {
        const agents = this.registry.listAgents();
        let output = "**Available agents:**\n\n";
        for (const name of agents) {
          const spec = this.registry.getAgent(name);
          output += `- **${name}**: ${spec?.description ?? "No description"}\n`;
          if (spec?.tools?.length) {
            output += `  - tools: ${spec.tools.join(", ")}\n`;
          }
        }
        this.addSystemMessage(output);
        this.requestRender();
        return;
      }
      if (trimmed === "/workflows") {
        const workflows = this.registry.listWorkflows();
        let output = "**Available workflows:**\n\n";
        for (const name of workflows) {
          const spec = this.registry.getWorkflow(name);
          output += `- **${name}**: ${spec?.description ?? "No description"}\n`;
          if (spec?.steps?.length) {
            output += `  - steps: ${spec.steps.map((s) => s.id).join(" → ")}\n`;
          }
        }
        this.addSystemMessage(output);
        this.requestRender();
        return;
      }
      if (trimmed.startsWith("/inspect ")) {
        const name = trimmed.slice(8).trim();
        const tool = this.registry.getTool(name);
        if (tool) {
          let output = `**Tool: ${tool.name}**\n\n`;
          if (tool.description) output += `${tool.description}\n\n`;
          if (tool.input_schema) {
            output += `**Input Schema:**\n\`\`\`json\n${JSON.stringify(tool.input_schema, null, 2)}\n\`\`\`\n`;
          }
          this.addSystemMessage(output);
          this.requestRender();
          return;
        }
        const agent = this.registry.getAgent(name);
        if (agent) {
          let output = `**Agent: ${agent.name}**\n\n`;
          if (agent.description) output += `${agent.description}\n\n`;
          if (agent.tools?.length) {
            output += `**Tools:** ${agent.tools.join(", ")}\n`;
          }
          if (agent.system_prompt) {
            output += `\n**System Prompt:**\n${agent.system_prompt}\n`;
          }
          this.addSystemMessage(output);
          this.requestRender();
          return;
        }
        const workflow = this.registry.getWorkflow(name);
        if (workflow) {
          let output = `**Workflow: ${workflow.name}**\n\n`;
          if (workflow.description) output += `${workflow.description}\n\n`;
          output += "**Steps:**\n";
          for (const step of workflow.steps) {
            output += `- ${step.id}: ${step.agent}\n`;
            if (step.input_schema && Object.keys(step.input_schema).length) {
              output += `  - input_schema: ${JSON.stringify(step.input_schema)}\n`;
            }
            if (step.output_ref) {
              output += `  - output_ref: ${step.output_ref}\n`;
            }
          }
          this.addSystemMessage(output);
          this.requestRender();
          return;
        }
        this.addSystemMessage(`Not found: ${name}`);
        this.requestRender();
        return;
      }
      this.addSystemMessage(
        `Unknown command: ${trimmed}. Type /help for available commands.`,
      );
      this.requestRender();
      return;
    }

    this.addUserMessage(trimmed);
    this.onMessage?.(trimmed);
  }

  addUserMessage(content: string) {
    this.messages.push({ role: "user", content, timestamp: Date.now() });
    this.addMessageToBox("user", content);
    this.requestRender();
  }

  addAssistantMessage(content: string) {
    this.messages.push({
      role: "assistant",
      content,
      timestamp: Date.now(),
    });
    this.addMessageToBox("assistant", content);
    this.requestRender();
  }

  addSystemMessage(content: string) {
    this.messages.push({ role: "system", content, timestamp: Date.now() });
    const md = new Markdown(content, 1, 0, markdownTheme, {
      color: (t) => this.tuiTheme.systemMessage(t),
    });
    this.messagesBox.addChild(md);
    this.requestRender();
  }

  addToolCall(toolName: string, params: string) {
    this.currentToolCall = toolName;
    this.messages.push({
      role: "tool",
      content: `${toolName}(${params})`,
      toolName,
      timestamp: Date.now(),
    });

    const toolMd = new Markdown(
      `🔧 **Tool:** ${toolName}\n\`\`\`\n${params}\n\`\`\``,
      1,
      2,
      markdownTheme,
      { color: (t) => this.tuiTheme.toolCall(t) },
    );
    this.messagesBox.addChild(toolMd);
    this.requestRender();
  }

  addToolResult(result: string) {
    const resultMd = new Markdown(`└── ✅ ${result}`, 1, 4, markdownTheme, {
      color: (t) => this.tuiTheme.toolResult(t),
    });
    this.messagesBox.addChild(resultMd);
    this.requestRender();
  }

  addDelegation(agentName: string, task: string) {
    this.messages.push({
      role: "delegation",
      content: `→ ${agentName}: ${task}`,
      agentName,
      timestamp: Date.now(),
    });

    const delegMd = new Markdown(
      `🤖 **Delegating to:** ${agentName}\n\`\`\`\n${task}\n\`\`\``,
      1,
      2,
      markdownTheme,
      { color: (t) => this.tuiTheme.delegation(t) },
    );
    this.messagesBox.addChild(delegMd);
    this.requestRender();
  }

  startLoading() {
    this.inputField.disableSubmit = true;
    this.loadingLoader = new CancellableLoader(
      null as any,
      (s) => chalk.cyan(s),
      (s) => chalk.gray(s),
      "🤔 Thinking...",
    );
    this.loadingLoader.onAbort = () => {};
    this.messagesBox.addChild(this.loadingLoader);
    this.requestRender();
  }

  stopLoading() {
    if (this.loadingLoader) {
      this.loadingLoader.stop();
      this.messagesBox.removeChild(this.loadingLoader);
      this.loadingLoader = undefined;
    }
    this.inputField.disableSubmit = false;
    this.requestRender();
  }

  appendStreamingContent(content: string) {
    this.streamingContent += content;
    this.updateStreamingMessage();
  }

  appendStreamingThinking(content: string) {
    this.streamingThinking += content;
    this.updateStreamingMessage();
  }

  private updateStreamingMessage() {
    let lastChild =
      this.messagesBox.children[this.messagesBox.children.length - 1];

    if (lastChild && lastChild instanceof Markdown) {
      this.messagesBox.removeChild(lastChild);
    }

    let content = this.streamingContent;
    if (this.streamingThinking) {
      content = `<thinking>${this.streamingThinking}</thinking>\n\n${content}`;
    }

    const md = new Markdown(content, 1, 0, markdownTheme, {
      color: (t) => chalk.white(t),
    });
    this.messagesBox.addChild(md);
    this.requestRender();
  }

  finishStreaming() {
    this.streamingContent = "";
    this.streamingThinking = "";
    this.currentToolCall = null;
    this.requestRender();
  }

  private addMessageToBox(role: "user" | "assistant", content: string) {
    const colorFn =
      role === "user"
        ? (t: string) => chalk.bgBlue.white(t)
        : (t: string) => chalk.bgBlack.white(t);

    const prefix = role === "user" ? "👤 You: " : "🤖 Assistant: ";
    const displayContent = prefix + content;

    const md = new Markdown(displayContent, 1, 0, markdownTheme, {
      color: colorFn,
    });
    this.messagesBox.addChild(md);
  }

  private requestRender() {
    this.container.invalidate?.();
    this.tui.requestRender();
  }

  render(width: number): string[] {
    return this.container.render(width);
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.ctrl("c"))) {
      this.onExit?.();
      return;
    }

    if (matchesKey(data, Key.tab) && this.assistant) {
      const newAgent = this.assistant.cycleActiveAgent();
      const agents = this.assistant.getAvailableAgents();
      this.addSystemMessage(
        chalk.cyan(`🤖 Switched to agent: ${newAgent} (${agents.join(", ")})`),
      );
      this.updateHint();
      return;
    }

    this.inputField.handleInput?.(data);
  }

  invalidate(): void {
    this.container.invalidate?.();
  }
}
