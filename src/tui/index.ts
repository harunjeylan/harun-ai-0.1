import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";
import chalk from "chalk";
import { createApp } from "../core/app.js";
import { ChatComponent } from "../ui/chat.js";

export async function runTui(): Promise<void> {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  const app = await createApp();

  const chat = new ChatComponent(tui, app.registry, undefined, app.assistant);
  const hasApiKey = app.assistant.hasApiKey();
  if (!hasApiKey) {
    chat.addSystemMessage(
      chalk.red(
        `Missing API key for provider "${app.assistant.provider}". Messages will not be sent until you set it in providers/${app.assistant.provider}.json and restart.`,
      ) +
        "\n\n" +
        chalk.gray(
          "Example: { \"apiKey\": \"...\" }",
        ),
    );
  }

  setTimeout(() => {
    chat.focused = true;
  }, 100);

  chat.onMessage = async (text: string) => {
    if (!hasApiKey) {
      chat.addSystemMessage(
        chalk.red(
          `Cannot send: missing API key for provider "${app.assistant.provider}".`,
        ),
      );
      return;
    }
    chat.startLoading();

    let sawDelta = false;
    const unsubscribe = app.assistant.subscribe((e) => {
      const anyEvent = e as any;

      if (anyEvent?.type === "message_update") {
        const ev = anyEvent.assistantMessageEvent;
        if (ev.type === "text_delta") {
          sawDelta = true;
          chat.appendStreamingContent(ev.delta);
        }
        if (ev.type === "thinking_delta") {
          sawDelta = true;
          chat.appendStreamingThinking(ev.delta);
        }
        if (ev.type === "tool_call") {
          sawDelta = true;
          const toolName = ev.toolCall?.name ?? "unknown";
          const params = JSON.stringify(ev.toolCall?.parameters ?? {}, null, 2);
          chat.addToolCall(toolName, params);
        }
        if (ev.type === "tool_result") {
          sawDelta = true;
          const result = typeof ev.result?.content === "string" 
            ? ev.result.content 
            : JSON.stringify(ev.result?.content ?? "Done");
          chat.addToolResult(result.slice(0, 200));
        }
        if (ev.type === "error") {
          sawDelta = true;
          chat.appendStreamingContent(
            `\n\nError: ${ev.error?.errorMessage ?? "Unknown error"}\n`,
          );
        }
      }

      if (
        anyEvent?.type === "error" ||
        anyEvent?.type === "agent_error" ||
        anyEvent?.type === "turn_error"
      ) {
        sawDelta = true;
        const msg =
          anyEvent?.error?.errorMessage ??
          anyEvent?.error?.message ??
          anyEvent?.message ??
          "Unknown error";
        chat.appendStreamingContent(`\n\nError: ${msg}\n`);
      }
    });

    try {
      const timeoutMs = 45000;
      const timeout = setTimeout(() => {
        chat.appendStreamingContent(
          `\n\n${chalk.red(`Timed out after ${timeoutMs}ms. Check network/API key and try again.`)}\n`,
        );
        app.assistant.abort();
      }, timeoutMs);

      try {
        await app.assistant.prompt(text);
        await app.assistant.waitForIdle();

        if (!sawDelta) {
          const finalText = app.assistant.getLastAssistantText();
          if (finalText && finalText.trim().length > 0) {
            chat.addAssistantMessage(finalText);
          } else {
            chat.addSystemMessage(
              chalk.yellow("No output received from the assistant."),
            );
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      chat.appendStreamingContent(
        `\n\nError: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    } finally {
      unsubscribe();
      chat.finishStreaming();
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
