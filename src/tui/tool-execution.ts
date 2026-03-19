import {
  Container,
  Text,
  Spacer,
  type MarkdownTheme,
} from "@mariozechner/pi-tui";
import chalk from "chalk";

export class ToolExecutionComponent extends Container {
  private state: "pending" | "success" | "error" = "pending";
  private toolName: string;
  private args: any;
  private result: any;
  private contentContainer: Container;

  constructor(toolName: string, args: any, _markdownTheme: MarkdownTheme) {
    super();
    this.toolName = toolName;
    this.args = args;
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);
    this.updateDisplay();
  }

  private getPrefix(): string {
    switch (this.state) {
      case "pending":
        return chalk.yellow("◉");
      case "success":
        return chalk.green("✓");
      case "error":
        return chalk.red("✗");
    }
  }

  updateDisplay(): void {
    this.contentContainer.clear();

    const prefix = this.getPrefix();

    // this.contentContainer.addChild(new Spacer(1));

    const toolHeader = `${prefix} ${chalk.bold(this.toolName)}`;
    this.contentContainer.addChild(new Text(toolHeader, 1, 0));

    if (this.args && Object.keys(this.args).length > 0) {
      const argsStr = JSON.stringify(this.args, null, 2)
        .split("\n")
        .slice(1, -1)
        .join("\n")
        .trim();
      if (argsStr) {
        const argsLines = argsStr
          .split("\n")
          .map((line) => "  " + chalk.dim(line));
        this.contentContainer.addChild(new Text(argsLines.join("\n"), 1, 0));
      }
    }

    if (this.result) {
      if (typeof this.result === "object" && this.result.content) {
        for (const item of this.result.content) {
          if (item.type === "text") {
            const resultLines = item.text.split("\n").slice(0, 10);
            for (const line of resultLines) {
              const linePrefix =
                this.state === "error" ? chalk.red("  ") : "  ";
              this.contentContainer.addChild(
                new Text(linePrefix + chalk.dim(line), 1, 0),
              );
            }
            if (item.text.split("\n").length > 10) {
              this.contentContainer.addChild(
                new Text("  " + chalk.dim("..."), 1, 0),
              );
            }
          }
        }
      } else if (typeof this.result === "string") {
        const resultLines = this.result.split("\n").slice(0, 10);
        for (const line of resultLines) {
          this.contentContainer.addChild(
            new Text("  " + chalk.dim(line), 1, 0),
          );
        }
        if (this.result.split("\n").length > 10) {
          this.contentContainer.addChild(
            new Text("  " + chalk.dim("..."), 1, 0),
          );
        }
      }
    }

    this.contentContainer.addChild(new Spacer(1));
  }

  updateArgs(args: any): void {
    this.args = args;
    this.updateDisplay();
  }

  updateResult(result: any, isPartial = false): void {
    this.result = result;
    if (!isPartial) {
      this.state = result?.isError ? "error" : "success";
    }
    this.updateDisplay();
  }

  setState(state: "pending" | "success" | "error"): void {
    this.state = state;
    this.updateDisplay();
  }
}
