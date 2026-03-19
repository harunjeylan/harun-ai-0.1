import chalk from "chalk";

export interface TuiTheme {
  // Colors
  primary: (str: string) => string;
  secondary: (str: string) => string;
  accent: (str: string) => string;
  muted: (str: string) => string;
  error: (str: string) => string;
  warning: (str: string) => string;
  success: (str: string) => string;
  info: (str: string) => string;
  
  // Backgrounds
  bgPrimary: (str: string) => string;
  bgSecondary: (str: string) => string;
  bgInput: (str: string) => string;
  
  // Text
  textPrimary: (str: string) => string;
  textSecondary: (str: string) => string;
  textMuted: (str: string) => string;
  
  // Border
  border: (str: string) => string;
  borderActive: (str: string) => string;
  
  // UI Elements
  logo: (str: string) => string;
  shortcut: (str: string) => string;
  agent: (str: string) => string;
  model: (str: string) => string;
  tip: (str: string) => string;
}

export const defaultTheme: TuiTheme = {
  // Colors - matching opencode style
  primary: chalk.hex("#4A9EFF"),
  secondary: chalk.hex("#FF8C42"),
  accent: chalk.hex("#50FA7B"),
  muted: chalk.hex("#6272A4"),
  error: chalk.hex("#FF5555"),
  warning: chalk.hex("#F1FA8C"),
  success: chalk.hex("#50FA7B"),
  info: chalk.hex("#8BE9FD"),
  
  // Backgrounds
  bgPrimary: (str) => str,
  bgSecondary: chalk.bgHex("#282A36"),
  bgInput: chalk.bgHex("#1E1E2E"),
  
  // Text
  textPrimary: chalk.hex("#F8F8F2"),
  textSecondary: chalk.hex("#BFBFBF"),
  textMuted: chalk.hex("#6272A4"),
  
  // Border
  border: chalk.hex("#44475A"),
  borderActive: chalk.hex("#4A9EFF"),
  
  // UI Elements
  logo: chalk.hex("#F8F8F2"),
  shortcut: chalk.hex("#F8F8F2"),
  agent: chalk.hex("#FF8C42"),
  model: chalk.hex("#4A9EFF"),
  tip: chalk.hex("#F1FA8C"),
};

export const markdownTheme = {
  heading: chalk.hex("#FF79C6"),
  link: chalk.hex("#8BE9FD"),
  linkUrl: chalk.hex("#6272A4"),
  code: chalk.bgHex("#44475A").hex("#F8F8F2"),
  codeBlock: chalk.hex("#F8F8F2"),
  codeBlockBorder: chalk.hex("#44475A"),
  quote: chalk.hex("#F1FA8C"),
  quoteBorder: chalk.hex("#44475A"),
  hr: chalk.hex("#44475A"),
  listBullet: chalk.hex("#FF79C6"),
  bold: chalk.bold.hex("#F8F8F2"),
  italic: chalk.italic.hex("#F8F8F2"),
  strikethrough: chalk.strikethrough.hex("#F8F8F2"),
  underline: chalk.underline.hex("#F8F8F2"),
};

export const selectListTheme = {
  selectedPrefix: chalk.hex("#50FA7B"),
  selectedText: chalk.hex("#F8F8F2"),
  description: chalk.hex("#6272A4"),
  scrollInfo: chalk.hex("#6272A4"),
  noMatch: chalk.hex("#FF5555"),
};

export const settingsListTheme = {
  label: (text: string, selected: boolean) => 
    selected ? chalk.hex("#F8F8F2")(text) : chalk.hex("#BFBFBF")(text),
  value: (text: string, selected: boolean) => 
    selected ? chalk.hex("#4A9EFF")(text) : chalk.hex("#6272A4")(text),
  description: chalk.hex("#6272A4"),
  cursor: "> ",
  hint: chalk.hex("#6272A4"),
};

export const editorTheme = {
  borderColor: chalk.hex("#44475A"),
  selectList: selectListTheme,
};
