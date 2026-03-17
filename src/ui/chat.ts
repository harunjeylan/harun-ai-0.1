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

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
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

  private tui: TuiType;

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
    private tuiTheme: ChatTheme = chatTheme,
  ) {
    this.tui = tui;
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
        ],
        process.cwd(),
      ),
    );
    this.container.addChild(this.inputField);

    this.hint = new Markdown(
      "Hint: `Tab` autocomplete · `Alt+Enter` new line · `/help` commands",
      1,
      0,
      markdownTheme,
      { color: (t) => chalk.gray(t) },
    );
    this.container.addChild(this.hint);

    this.addSystemMessage(
      "Welcome to HarunAI! Type a message or /help for commands.",
    );
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
            "/exit - Exit the application",
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

  addAssistantMessage(content: string, thinking?: string) {
    this.messages.push({
      role: "assistant",
      content,
      thinking,
      timestamp: Date.now(),
    });
    this.addMessageToBox("assistant", content, thinking);
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

  startLoading() {
    this.inputField.disableSubmit = true;
    this.loadingLoader = new CancellableLoader(
      null as any,
      (s) => chalk.cyan(s),
      (s) => chalk.gray(s),
      "Thinking...",
    );
    this.loadingLoader.onAbort = () => {
      // TUI will stop the loader when abort is requested.
    };
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
    this.requestRender();
  }

  private addMessageToBox(
    role: "user" | "assistant",
    content: string,
    thinking?: string,
  ) {
    const prefix = role === "user" ? "You: " : "Assistant: ";
    let displayContent = content;

    if (thinking) {
      displayContent = `<thinking>${thinking}</thinking>\n\n${content}`;
    }

    const md = new Markdown(displayContent, 1, 0, markdownTheme, {
      color: (t) => chalk.white(t),
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
    this.inputField.handleInput?.(data);
  }

  invalidate(): void {
    this.container.invalidate?.();
  }
}
