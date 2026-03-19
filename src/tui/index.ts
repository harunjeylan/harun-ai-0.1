/**
 * Modern Terminal UI for HarunAI
 * Uses @mariozechner/pi-tui for a rich, flicker-free interface
 */

import { getApiProviders } from "@mariozechner/pi-ai";
import {
  CombinedAutocompleteProvider,
  type Component,
  Container,
  Editor,
  type EditorTheme,
  Key,
  Loader,
  Markdown,
  type MarkdownTheme,
  matchesKey,
  ProcessTerminal,
  SelectList,
  Spacer,
  TUI,
} from "@mariozechner/pi-tui";
import chalk from "chalk";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { App } from "../core/app";
import { SessionManagerFactory } from "../session/factory";
import type { SessionInfo } from "../session/types";
import { StreamingMessageComponent } from "./streaming-message";
import { ToolExecutionComponent } from "./tool-execution";

const SESSIONS_DIR = join(homedir(), ".harunai", "sessions");

// Theme configuration
const theme = {
  userMessageBg: chalk.bgHex("#2d2d3a"),
  assistantMessageBg: chalk.bgBlack,
  border: chalk.hex("#5c5c7a"),
  dim: chalk.gray,
  error: chalk.red,
  warning: chalk.yellow,
  success: chalk.green,
  cyan: chalk.cyan,
  magenta: chalk.magenta,
};

const editorTheme: EditorTheme = {
  borderColor: (s) => theme.border(s),
  selectList: {
    selectedPrefix: (s) => chalk.cyan(s),
    selectedText: (s) => chalk.white.bold(s),
    description: (s) => theme.dim(s),
    scrollInfo: (s) => theme.dim(s),
    noMatch: (s) => theme.dim(s),
  },
};

const markdownTheme: MarkdownTheme = {
  heading: (s) => chalk.white.bold(s),
  link: (s) => chalk.cyan.underline(s),
  linkUrl: (s) => chalk.cyan(s),
  code: (s) => chalk.yellow(s),
  codeBlock: (s) => chalk.yellow(s),
  codeBlockBorder: (s) => theme.dim(s),
  quote: (s) => chalk.green(s),
  quoteBorder: (s) => chalk.green("│ "),
  hr: (s) => theme.dim(s),
  listBullet: (s) => chalk.cyan(s),
  bold: (s) => chalk.bold(s),
  italic: (s) => chalk.italic(s),
  strikethrough: (s) => chalk.strikethrough(s),
  underline: (s) => chalk.underline(s),
};

// Slash commands for autocomplete
const slashCommands = [
  { name: "agents", description: "List and switch agents" },
  { name: "tools", description: "List all available tools" },
  { name: "workflows", description: "List all workflows" },
  { name: "providers", description: "List available LLM providers" },
  { name: "settings", description: "Open settings menu" },
  { name: "model", description: "Select model (opens selector UI)" },
  { name: "clear", description: "Clear the chat history" },
  { name: "new", description: "Start a new session" },
  { name: "sessions", description: "Browse and switch sessions" },
  { name: "help", description: "Show available commands" },
  { name: "exit", description: "Exit HarunAI", aliases: ["quit"] },
];

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

/**
 * Footer component showing pwd, cost, and token stats
 */
class FooterComponent implements Component {
  constructor(private app: App) {}

  invalidate(): void {
    // No-op - re-render on next frame
  }

  render(width: number): string[] {
    // Get working directory
    let pwd = process.cwd();
    const home = homedir();
    if (pwd.startsWith(home)) {
      pwd = `~${pwd.slice(home.length)}`;
    }

    // Get session stats
    const entries = this.app.sessionManager.getEntries();
    let messageCount = 0;
    for (const entry of entries) {
      if (entry.type === "message") messageCount++;
    }

    // Build stats
    const statsParts: string[] = [];

    // Cost (placeholder - implement actual cost tracking)
    statsParts.push("$0.000");

    // Message count
    if (messageCount > 0) {
      statsParts.push(`↑${messageCount}`);
    }

    // Context usage (placeholder - implement actual token counting)
    const contextWindow = 128000; // Default context window
    const contextUsed = 0; // Calculate from session
    const contextPercent = ((contextUsed / contextWindow) * 100).toFixed(1);
    statsParts.push(`${contextPercent}%/${Math.round(contextWindow / 1000)}k`);

    const statsLeft = statsParts.join(" ");
    const rightSide = this.app.sessionManager.getSessionName() || "HarunAI";

    // Build status line with right-aligned model name
    const statsLeftWidth = statsLeft.length;
    const rightSideWidth = rightSide.length;
    const padding = " ".repeat(
      Math.max(2, width - statsLeftWidth - rightSideWidth),
    );
    const statsLine = statsLeft + padding + rightSide;

    const pwdLine = pwd.slice(0, width);

    return [theme.dim(pwdLine), theme.dim(statsLine)];
  }
}

/**
 * Header component with ASCII art banner
 */
class HeaderComponent implements Component {
  private readonly banner = [
    "██╗  ██╗ █████╗ ██████╗ ██╗   ██╗███╗   ██╗ █████╗ ██╗",
    "██║  ██║██╔══██╗██╔══██╗██║   ██║████╗  ██║██╔══██╗██║",
    "███████║███████║██████╔╝██║   ██║██╔██╗ ██║███████║██║",
    "██╔══██║██╔══██║██╔══██╗██║   ██║██║╚██╗██║██╔══██║██║",
    "██║  ██║██║  ██║██║  ██║╚██████╔╝██║ ╚████║██║  ██║██║",
    "╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝",
  ];

  invalidate(): void {}

  render(width: number): string[] {
    // Center the banner
    const padding = Math.max(
      0,
      Math.floor((width - this.banner[0].length) / 2),
    );
    const centeredBanner = this.banner.map(
      (line) => " ".repeat(padding) + line,
    );
    return centeredBanner.map((line) => chalk.cyan(line));
  }
}

/**
 * User message component with box styling
 */
class UserMessageComponent implements Component {
  invalidate(): void {}

  constructor(private message: Message) {}

  render(width: number): string[] {
    const lines = this.message.content.split("\n");
    const paddingX = 2;
    const paddingY = 1;
    const maxContentWidth = width - paddingX * 2 - 2;

    const wrappedLines: string[] = [];
    for (const line of lines) {
      if (line.length <= maxContentWidth) {
        wrappedLines.push(line);
      } else {
        for (let i = 0; i < line.length; i += maxContentWidth) {
          wrappedLines.push(line.slice(i, i + maxContentWidth));
        }
      }
    }

    const paddedLines = wrappedLines.map((line) => {
      const padding = " ".repeat(Math.max(0, maxContentWidth - line.length));
      return theme.userMessageBg(
        " ".repeat(paddingX) + line + padding + " ".repeat(paddingX),
      );
    });

    // Add vertical padding
    const emptyLine = theme.userMessageBg(" ".repeat(width));
    const result: string[] = [];
    for (let i = 0; i < paddingY; i++) {
      result.push(emptyLine);
    }
    result.push(...paddedLines);
    for (let i = 0; i < paddingY; i++) {
      result.push(emptyLine);
    }

    return result;
  }
}

/**
 * Assistant message component using Markdown
 */
class AssistantMessageComponent implements Component {
  invalidate(): void {}

  private markdown: Markdown;

  constructor(private message: Message) {
    this.markdown = new Markdown(message.content, 1, 1, markdownTheme);
  }

  render(width: number): string[] {
    return this.markdown.render(width);
  }
}

/**
 * Session selector component
 */
class SessionSelectorComponent implements Component {
  invalidate(): void {}

  private selectedIndex = 0;

  constructor(
    private sessions: SessionInfo[],
    private onSelect: (session: SessionInfo | null) => void,
  ) {}

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(
        this.sessions.length,
        this.selectedIndex + 1,
      );
    } else if (matchesKey(data, Key.enter)) {
      if (this.selectedIndex === this.sessions.length) {
        this.onSelect(null); // New session
      } else {
        this.onSelect(this.sessions[this.selectedIndex]);
      }
    } else if (data === "n" || data === "N") {
      this.onSelect(null); // New session
    } else if (data === "q" || data === "Q") {
      process.exit(0);
    }
  }

  render(width: number): string[] {
    const lines: string[] = [];
    lines.push(chalk.bold("Select a session to resume:"));
    lines.push("");

    this.sessions.forEach((session, index) => {
      const prefix = index === this.selectedIndex ? chalk.cyan("→ ") : "  ";
      const name = session.name || `Session ${index + 1}`;
      const date = new Date(session.modified).toLocaleDateString();
      const label = `${prefix}${name} ${theme.dim(`(${date}, ${session.messageCount} messages)`)}`;
      lines.push(label);
    });

    const newPrefix =
      this.selectedIndex === this.sessions.length ? chalk.cyan("→ ") : "  ";
    lines.push(`${newPrefix}${chalk.bold("New session")}`);
    lines.push("");
    lines.push(theme.dim("↑↓ navigate, Enter select, n new, q quit"));

    return lines;
  }
}

/**
 * Main TUI class
 */
export class HarunTUI {
  private tui: TUI;
  private app: App;
  private chatContainer: Container;
  private statusContainer: Container;
  private editor: Editor;
  private footer: FooterComponent;
  private messages: Message[] = [];
  private sessionOverlayHandle: ReturnType<TUI["showOverlay"]> | undefined;
  private streamingComponent: StreamingMessageComponent | undefined;
  private loadingAnimation: Loader | undefined;
  private unsubscribeAgent: (() => void) | undefined;
  private pendingTools = new Map<string, ToolExecutionComponent>();

  constructor(app: App) {
    this.app = app;

    // Create TUI
    this.tui = new TUI(new ProcessTerminal(), false);

    // Create containers
    this.chatContainer = new Container();
    this.statusContainer = new Container();

    // Create editor
    this.editor = new Editor(this.tui, editorTheme);
    this.editor.onSubmit = (text) => this.handleSubmit(text);

    // Setup autocomplete
    const autocompleteProvider = new CombinedAutocompleteProvider(
      slashCommands.map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
      })),
      process.cwd(),
    );
    this.editor.setAutocompleteProvider(autocompleteProvider);

    // Create footer
    this.footer = new FooterComponent(app);

    // Create header
    const header = new HeaderComponent();

    // Setup layout
    this.tui.addChild(header);
    this.tui.addChild(this.chatContainer);
    this.tui.addChild(this.statusContainer);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(this.editor);
    this.tui.addChild(new Spacer(1));
    this.tui.addChild(this.footer);

    // Subscribe to agent events
    this.unsubscribeAgent = this.app.assistant.subscribe((event: any) =>
      this.handleAgentEvent(event),
    );

    // Add global input listener for Escape key (abort)
    this.tui.addInputListener((data) => {
      if (matchesKey(data, Key.escape)) {
        if (this.loadingAnimation || this.streamingComponent || this.pendingTools.size > 0) {
          this.app.assistant.abort();
          this.showLoading(false);
          if (this.streamingComponent) {
            const content = this.streamingComponent.getContent();
            const thinking = this.streamingComponent.getThinking();
            if (content.trim() || thinking.trim()) {
              this.finalizeStreamingMessage(content, "Aborted");
            } else {
              this.chatContainer.removeChild(this.streamingComponent);
              this.streamingComponent = undefined;
            }
          }
          this.tui.requestRender();
          return { consume: true };
        }
      }
    });

    // CRITICAL: Set focus on the editor so it can receive keyboard input
    this.tui.setFocus(this.editor);
  }

  async start(): Promise<void> {
    // Ensure sessions directory exists
    if (!existsSync(SESSIONS_DIR)) {
      mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    // Start TUI first so components can receive input
    this.tui.start();

    // Show session selector
    const sessions = await SessionManagerFactory.list(process.cwd());
    if (sessions.length > 0) {
      const selector = new SessionSelectorComponent(sessions, (session) => {
        if (session) {
          this.app.sessionManager = SessionManagerFactory.open(session.path);
        } else {
          this.app.sessionManager = SessionManagerFactory.create(process.cwd());
        }
        // Hide overlay and restore focus
        if (this.sessionOverlayHandle) {
          this.sessionOverlayHandle.hide();
        } else {
          this.tui.hideOverlay();
        }
        this.restoreMessages();
        this.tui.requestRender();
      });

      this.sessionOverlayHandle = this.tui.showOverlay(selector, {
        anchor: "center",
        width: "80%",
        maxHeight: "50%",
      });
    } else {
      // No existing sessions, create a new one
      this.app.sessionManager = SessionManagerFactory.create(process.cwd());
    }
  }

  private restoreMessages(): void {
    const entries = this.app.sessionManager.getEntries();
    for (const entry of entries) {
      if (entry.type === "message") {
        const msg = entry.message;
        this.addMessage({
          id: entry.id,
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
          timestamp: entry.timestamp,
        });
      }
    }
  }

  private addMessage(message: Message): void {
    this.messages.push(message);

    let component: Component;
    if (message.role === "user") {
      component = new UserMessageComponent(message);
    } else {
      component = new AssistantMessageComponent(message);
    }

    this.chatContainer.addChild(component);
  }

  private async handleSubmit(text: string): Promise<void> {
    if (!text.trim()) return;

    // Handle commands
    if (text.startsWith("/")) {
      const command = text.slice(1).split(" ")[0];
      await this.handleCommand(command);
      return;
    }

    // Add user message
    this.addMessage({
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    });

    // Add to session
    this.app.sessionManager.appendMessage({
      role: "user",
      content: text,
    });

    this.tui.requestRender();

    // Start loading animation
    this.showLoading(true);

    // Send prompt (streaming will be handled via events)
    try {
      await this.app.assistant.prompt(text);
    } catch (error) {
      this.showLoading(false);
      this.addMessage({
        id: `msg_${Date.now()}_error`,
        role: "system",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      });
      this.tui.requestRender();
    }
  }

  private handleAgentEvent(event: any): void {
    switch (event.type) {
      case "agent_start":
        this.showLoading(true);
        break;

      case "message_start":
        if (event.message?.role === "assistant") {
          this.showLoading(false);
          // Create streaming component
          this.streamingComponent = new StreamingMessageComponent(
            markdownTheme,
          );
          this.chatContainer.addChild(this.streamingComponent);
          this.chatContainer.addChild(new Spacer(1));
          this.tui.requestRender();
        }
        break;

      case "message_update":
        if (this.streamingComponent && event.message?.role === "assistant") {
          const ev = event.assistantMessageEvent;
          if (ev?.type === "text_delta" && ev.delta) {
            this.streamingComponent.appendText(ev.delta);
          }
          if (ev?.type === "thinking_delta" && ev.delta) {
            this.streamingComponent.appendThinking(ev.delta);
          }
          this.tui.requestRender();
        }
        break;

      case "tool_execution_start": {
        const toolComponent = new ToolExecutionComponent(
          event.toolName,
          event.args,
          markdownTheme,
        );
        this.pendingTools.set(event.toolCallId, toolComponent);
        this.chatContainer.addChild(toolComponent);
        this.chatContainer.addChild(new Spacer(1));
        this.tui.requestRender();
        break;
      }

      case "tool_execution_update": {
        const toolComponent = this.pendingTools.get(event.toolCallId);
        if (toolComponent) {
          toolComponent.updateArgs(event.args);
          toolComponent.updateResult(event.partialResult, true);
          this.tui.requestRender();
        }
        break;
      }

      case "tool_execution_end": {
        const toolComponent = this.pendingTools.get(event.toolCallId);
        if (toolComponent) {
          toolComponent.updateResult(event.result, false);
          if (event.isError) {
            toolComponent.setState("error");
          } else {
            toolComponent.setState("success");
          }
          this.pendingTools.delete(event.toolCallId);
          this.tui.requestRender();
        }
        break;
      }

      case "message_end":
        if (this.streamingComponent && event.message?.role === "assistant") {
          const finalContent = this.streamingComponent.getContent();
          if (finalContent.trim()) {
            // Finalize and convert to static message
            this.finalizeStreamingMessage(
              finalContent,
              event.message.errorMessage,
            );
          } else if (event.message.errorMessage) {
            // Show error if no content
            this.addMessage({
              id: `msg_${Date.now()}_error`,
              role: "system",
              content: `Error: ${event.message.errorMessage}`,
              timestamp: Date.now(),
            });
          }
          this.streamingComponent = undefined;
          this.tui.requestRender();
        }
        break;

      case "agent_end":
        if (!this.streamingComponent) {
          this.showLoading(false);
        }
        break;

      case "error":
      case "agent_error":
      case "turn_error":
        this.showLoading(false);
        if (event.type === "error") {
          this.addMessage({
            id: `msg_${Date.now()}_error`,
            role: "system",
            content: `Error: ${event.error?.errorMessage ?? "Unknown error"}`,
            timestamp: Date.now(),
          });
        } else if (
          event.type === "agent_error" ||
          event.type === "turn_error"
        ) {
          this.addMessage({
            id: `msg_${Date.now()}_error`,
            role: "system",
            content: `Error: ${event.message ?? "Unknown error"}`,
            timestamp: Date.now(),
          });
        }
        this.tui.requestRender();
        break;
    }
  }

  private showLoading(show: boolean): void {
    if (show && !this.loadingAnimation) {
      this.statusContainer.clear();
      this.loadingAnimation = new Loader(
        this.tui,
        (s) => chalk.cyan(s),
        (s) => theme.dim(s),
        "Thinking...",
      );
      this.statusContainer.addChild(this.loadingAnimation);
    } else if (!show && this.loadingAnimation) {
      this.loadingAnimation.stop();
      this.loadingAnimation = undefined;
      this.statusContainer.clear();
    }
    this.tui.requestRender();
  }

  private finalizeStreamingMessage(
    content: string,
    errorMessage?: string,
  ): void {
    // Remove streaming component from container
    if (this.streamingComponent) {
      const idx = this.chatContainer.children.indexOf(this.streamingComponent);
      if (idx >= 0) {
        this.chatContainer.removeChild(this.streamingComponent);
      }
      // Also remove the spacer after it
      if (idx >= 0 && idx < this.chatContainer.children.length) {
        const nextChild = this.chatContainer.children[idx];
        if (nextChild instanceof Spacer) {
          this.chatContainer.removeChild(nextChild);
        }
      }
      this.streamingComponent = undefined;
    }

    const timestamp = Date.now();

    if (errorMessage) {
      this.addMessage({
        id: `msg_${timestamp}_error`,
        role: "system",
        content: `Error: ${errorMessage}`,
        timestamp,
      });
    } else {
      this.addMessage({
        id: `msg_${timestamp}_assistant`,
        role: "assistant",
        content,
        timestamp,
      });
      this.app.sessionManager.appendMessage({
        role: "assistant",
        content,
      });
    }
  }

  private async handleCommand(command: string): Promise<void> {
    switch (command) {
      case "agents":
        this.showAgentsSelector();
        break;

      case "tools":
        this.listTools();
        break;

      case "workflows":
        this.listWorkflows();
        break;

      case "providers":
        this.listProviders();
        break;

      case "new": {
        this.app.sessionManager = SessionManagerFactory.create(process.cwd());
        this.messages = [];
        while (this.chatContainer.children.length > 0) {
          this.chatContainer.removeChild(this.chatContainer.children[0]);
        }
        break;
      }
      case "sessions": {
        const sessions = await SessionManagerFactory.list(process.cwd());
        const selector = new SessionSelectorComponent(sessions, (session) => {
          if (session) {
            this.app.sessionManager = SessionManagerFactory.open(session.path);
            this.restoreMessages();
          }
          this.tui.hideOverlay();
          this.tui.requestRender();
        });
        this.tui.showOverlay(selector, { anchor: "center", width: "80%" });
        break;
      }
      case "clear":
        this.messages = [];
        while (this.chatContainer.children.length > 0) {
          this.chatContainer.removeChild(this.chatContainer.children[0]);
        }
        break;

      case "exit":
      case "quit":
        this.tui.stop();
        process.exit(0);
        break;

      case "help":
        this.addMessage({
          id: `msg_${Date.now()}_help`,
          role: "system",
          content: [
            "Available commands:",
            "  /agents     - List and switch agents",
            "  /tools      - List all tools",
            "  /workflows  - List all workflows",
            "  /providers  - List available providers",
            "  /settings   - Open settings menu",
            "  /model      - Select model",
            "  /new        - Start new session",
            "  /sessions   - Browse sessions",
            "  /clear      - Clear chat",
            "  /exit       - Exit HarunAI",
          ].join("\n"),
          timestamp: Date.now(),
        });
        break;
    }

    this.tui.requestRender();
  }

  private showAgentsSelector(): void {
    const availableAgents = this.app.assistant.getAvailableAgents();
    const activeAgent = this.app.assistant.getActiveAgent();

    const items = availableAgents.map((name) => ({
      label: name,
      description: name === activeAgent ? "(active)" : "",
      value: name,
    }));

    const selectListTheme = {
      selectedPrefix: (s: string) => chalk.cyan(s),
      selectedText: (s: string) => chalk.white.bold(s),
      description: (s: string) => theme.dim(s),
      scrollInfo: (s: string) => theme.dim(s),
      noMatch: (s: string) => theme.dim(s),
    };

    const list = new SelectList(items, 10, selectListTheme);
    list.onSelect = (item: { value: string }) => {
      if (item) {
        this.app.assistant.setActiveAgent(item.value);
        this.addMessage({
          id: `msg_${Date.now()}_agent`,
          role: "system",
          content: `Switched to agent: ${item.value}`,
          timestamp: Date.now(),
        });
      }
      this.tui.hideOverlay();
      this.tui.requestRender();
    };
    list.onCancel = () => {
      this.tui.hideOverlay();
      this.tui.requestRender();
    };

    this.tui.showOverlay(list, { anchor: "center", width: "60%" });
  }

  private listTools(): void {
    const tools = this.app.registry.listTools();
    const content = [
      "Available tools:",
      "",
      ...tools.map((name) => {
        const spec = this.app.registry.getTool(name);
        const desc = spec?.description ?? "";
        return `  ${name}${desc ? ` - ${desc}` : ""}`;
      }),
    ].join("\n");

    this.addMessage({
      id: `msg_${Date.now()}_tools`,
      role: "system",
      content,
      timestamp: Date.now(),
    });
  }

  private listWorkflows(): void {
    const workflows = this.app.registry.listWorkflows();
    const content = [
      "Available workflows:",
      "",
      ...workflows.map((name) => {
        const spec = this.app.registry.getWorkflow(name);
        const desc = spec?.description ?? "";
        const steps = spec?.steps?.map((s) => s.id).join(" → ") ?? "";
        return `  ${name}${desc ? ` - ${desc}` : ""}${steps ? ` [${steps}]` : ""}`;
      }),
    ].join("\n");

    this.addMessage({
      id: `msg_${Date.now()}_workflows`,
      role: "system",
      content,
      timestamp: Date.now(),
    });
  }

  private listProviders(): void {
    const providers = getApiProviders();
    const content = [
      "Available LLM providers:",
      "",
      ...providers.map((p) => `  ${p.api}`),
    ].join("\n");

    this.addMessage({
      id: `msg_${Date.now()}_providers`,
      role: "system",
      content,
      timestamp: Date.now(),
    });
  }
}

/**
 * Run the TUI
 */
export async function runTUI(app: App): Promise<void> {
  const tui = new HarunTUI(app);
  await tui.start();
}
