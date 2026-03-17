import chalk from "chalk";

export interface ChatTheme {
  userMessage: (text: string) => string;
  assistantMessage: (text: string) => string;
  systemMessage: (text: string) => string;
  input: (text: string) => string;
  prompt: (text: string) => string;
  error: (text: string) => string;
  thinking: (text: string) => string;
}

export const chatTheme: ChatTheme = {
  userMessage: (text) => chalk.bgBlue.white(text),
  assistantMessage: (text) => chalk.bgGray.white(text),
  systemMessage: (text) => chalk.gray(text),
  input: (text) => chalk.white(text),
  prompt: (text) => chalk.cyan.bold(text),
  error: (text) => chalk.red(text),
  thinking: (text) => chalk.gray.italic(text),
};

export const editorTheme = {
  borderColor: (str: string) => chalk.gray(str),
  selectList: {
    selectedPrefix: (text: string) => chalk.cyan(text),
    selectedText: (text: string) => chalk.white(text),
    description: (text: string) => chalk.gray(text),
    scrollInfo: (text: string) => chalk.gray(text),
    noMatch: (text: string) => chalk.yellow(text),
  },
};

export const markdownTheme = {
  heading: (text: string) => chalk.bold.cyan(text),
  link: (text: string) => chalk.blue.underline(text),
  linkUrl: (text: string) => chalk.blue(text),
  code: (text: string) => chalk.bgBlack.white(text),
  codeBlock: (text: string) => chalk.bgBlack.white(text),
  codeBlockBorder: (text: string) => chalk.gray(text),
  quote: (text: string) => chalk.italic.gray(text),
  quoteBorder: (text: string) => chalk.gray(text),
  hr: (text: string) => chalk.gray(text),
  listBullet: (text: string) => chalk.cyan(text),
  bold: (text: string) => chalk.bold(text),
  italic: (text: string) => chalk.italic(text),
  strikethrough: (text: string) => chalk.strikethrough(text),
  underline: (text: string) => chalk.underline(text),
};
