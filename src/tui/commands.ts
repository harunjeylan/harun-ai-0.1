import type { AutocompleteItem } from "@mariozechner/pi-tui";

export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  handler: () => void | Promise<void>;
}

// Convert our SlashCommands to AutocompleteItems for CombinedAutocompleteProvider
// Note: CombinedAutocompleteProvider handles the / prefix internally
export function toAutocompleteItems(
  commands: SlashCommand[],
): AutocompleteItem[] {
  return commands.map((cmd) => ({
    value: cmd.name,
    label: `/${cmd.name}`,
    description: cmd.description,
  }));
}

// Command registry to look up handlers
export class CommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();

  register(command: SlashCommand): void {
    this.commands.set(command.name, command);
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  get(name: string): SlashCommand | undefined {
    return this.commands.get(name);
  }

  getAll(): SlashCommand[] {
    const seen = new Set<string>();
    const result: SlashCommand[] = [];
    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        result.push(cmd);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
}

// Built-in commands
export function createDefaultCommands(
  onHelp: () => void,
  onClear: () => void,
  onExit: () => void,
  onAgents: () => void,
  onModels: () => void,
): SlashCommand[] {
  return [
    {
      name: "help",
      description: "Show available commands",
      handler: onHelp,
    },
    {
      name: "clear",
      description: "Clear the chat history",
      handler: onClear,
    },
    {
      name: "exit",
      description: "Exit the application",
      aliases: ["quit"],
      handler: onExit,
    },
    {
      name: "agents",
      description: "Switch between available agents",
      handler: onAgents,
    },
    {
      name: "models",
      description: "Switch between available models",
      handler: onModels,
    },
    {
      name: "new",
      description: "Start a new chat session",
      handler: () => {
        // Handled specially in main TUI
      },
    },
    {
      name: "save",
      description: "Save the current session",
      handler: () => {
        // Handled specially in main TUI
      },
    },
  ];
}
