import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import chalk from "chalk";
import { createApp } from "../core/app.js";
import { ChatComponent } from "../ui/chat.js";

export async function runTui(): Promise<void> {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  const app = await createApp();

  if (!app.assistant.hasApiKey()) {
    console.log(
      chalk.red(
        `[assistant] Missing API key for provider "${app.assistant.provider}". Set env var and retry.\n`,
      ),
    );
    console.log(
      chalk.gray(
        "See `pi-ai.md` for provider env vars (e.g. OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY).\n",
      ),
    );
    process.exit(1);
  }

  const chat = new ChatComponent(tui);

  setTimeout(() => {
    chat.focused = true;
  }, 100);

  chat.onMessage = async (text: string) => {
    chat.startLoading();

    const unsubscribe = app.assistant.subscribe((e) => {
      if (e.type === "message_update") {
        const ev = e.assistantMessageEvent;
        if (ev.type === "text_delta") {
          chat.appendStreamingContent(ev.delta);
        }
        if (ev.type === "thinking_delta") {
          chat.appendStreamingThinking(ev.delta);
        }
        if (ev.type === "error") {
          chat.appendStreamingContent(
            `\n\nError: ${ev.error.errorMessage ?? "Unknown error"}\n`,
          );
        }
      }
    });

    try {
      const timeoutMs = Number(process.env.HARUNAI_TIMEOUT_MS ?? "45000");
      const timeout = setTimeout(() => {
        chat.appendStreamingContent(
          `\n\n${chalk.red(`Timed out after ${timeoutMs}ms. Check network/API key and try again.`)}\n`,
        );
        app.assistant.abort();
      }, timeoutMs);

      try {
        await app.assistant.prompt(text);
        await app.assistant.waitForIdle();
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      chat.appendStreamingContent(
        `\n\nError: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    } finally {
      unsubscribe();
      chat.stopLoading();
    }
  };

  chat.onExit = () => {
    tui.stop();
    app.scheduler.stopAll();
    process.exit(0);
  };

  tui.addChild(chat);
  tui.setFocus(chat);
  tui.start();
}
