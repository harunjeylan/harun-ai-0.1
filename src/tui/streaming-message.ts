import { Container, Markdown, Spacer, Text, type MarkdownTheme } from "@mariozechner/pi-tui";

export class StreamingMessageComponent extends Container {
  private contentContainer: Container;
  private markdownTheme: MarkdownTheme;
  private fullText = "";

  constructor(markdownTheme: MarkdownTheme) {
    super();
    this.markdownTheme = markdownTheme;
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);
  }

  updateContent(text: string): void {
    this.fullText = text;

    this.contentContainer.clear();

    if (this.fullText.trim()) {
      this.contentContainer.addChild(new Spacer(1));
      this.contentContainer.addChild(new Markdown(this.fullText, 1, 0, this.markdownTheme));
    }
  }

  appendText(delta: string): void {
    this.fullText += delta;
    this.updateContent(this.fullText);
  }

  complete(): void {
    // No-op for now
  }

  getContent(): string {
    return this.fullText;
  }
}
