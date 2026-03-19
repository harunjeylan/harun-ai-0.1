import {
  Container,
  Markdown,
  Text,
  type MarkdownTheme,
  Spacer,
} from "@mariozechner/pi-tui";
import chalk from "chalk";

export class StreamingMessageComponent extends Container {
  private contentContainer: Container;
  private markdownTheme: MarkdownTheme;
  private fullText = "";
  private thinkingText = "";

  constructor(markdownTheme: MarkdownTheme) {
    super();
    this.markdownTheme = markdownTheme;
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);
  }

  updateContent(text: string, thinking?: string): void {
    this.fullText = text;

    this.contentContainer.clear();

    if (thinking && thinking.trim()) {
      const thinkingLines = thinking.split("\n");
      const formattedThinking = thinkingLines
        .map((line) => chalk.italic(chalk.gray(line)))
        .join("\n");
      this.contentContainer.addChild(new Spacer(1));
      this.contentContainer.addChild(new Text(formattedThinking, 1, 0));
      this.contentContainer.addChild(new Spacer(1));
    }

    if (this.fullText.trim()) {
      this.contentContainer.addChild(
        new Markdown(this.fullText, 1, 1, this.markdownTheme),
      );
    }
  }

  appendText(delta: string): void {
    this.fullText += delta;
    this.updateContent(this.fullText, this.thinkingText);
  }

  appendThinking(delta: string): void {
    this.thinkingText += delta;
    this.updateContent(this.fullText, this.thinkingText);
  }

  complete(): void {
    // No-op for now
  }

  getContent(): string {
    return this.fullText;
  }

  getThinking(): string {
    return this.thinkingText;
  }
}
