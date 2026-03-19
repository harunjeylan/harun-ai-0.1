/**
 * Type definitions for HarunAI settings
 */

export interface ModelSettings {
  provider?: string;
  modelId?: string;
}

export interface UISettings {
  theme?: "dark" | "light";
  showThinking?: boolean;
  streaming?: boolean;
}

export interface CompactionSettings {
  enabled?: boolean;
  contextWindow?: number;
  reserveTokens?: number;
  keepRecentTokens?: number;
  triggerThreshold?: number;
  verbose?: boolean;
}

export interface KeybindingSettings {
  abort?: string;
  [key: string]: string | undefined;
}

export interface HarunAISettings {
  model?: ModelSettings;
  ui?: UISettings;
  compaction?: CompactionSettings;
  keybindings?: KeybindingSettings;
  [key: string]: unknown;
}

export const DEFAULT_SETTINGS: HarunAISettings = {
  model: {
    provider: "google",
    modelId: "gemini-2.0-flash",
  },
  ui: {
    theme: "dark",
    showThinking: true,
    streaming: true,
  },
  compaction: {
    enabled: true,
    contextWindow: 8192,
    reserveTokens: 2048,
    keepRecentTokens: 4000,
    triggerThreshold: 0.75,
    verbose: false,
  },
  keybindings: {
    abort: "escape",
  },
};
