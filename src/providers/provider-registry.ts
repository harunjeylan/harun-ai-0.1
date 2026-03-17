import fs from "node:fs";
import { z } from "zod";
import { getModel, type Model } from "@mariozechner/pi-ai";

export type ProviderConfig = {
  provider: string;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
};

const DefaultsFileSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
});
type DefaultsFile = z.infer<typeof DefaultsFileSchema>;

const ProviderFileSchema = z.object({
  apiKey: z.string().min(1),
  modelId: z.string().optional(),
  baseUrl: z.string().optional(),
  headers: z.record(z.string()).optional(),
});
type ProviderFile = z.infer<typeof ProviderFileSchema>;

const AgentsFileSchema = z.object({
  agents: z.record(
    z.object({
      provider: z.string().min(1),
      modelId: z.string().min(1),
      apiKey: z.string().optional(),
    }),
  ),
});
type AgentsFile = z.infer<typeof AgentsFileSchema>;

const jsonCache = new Map<string, unknown | null>();

function loadJsonFile<T>(
  filePath: string,
  schema: z.ZodSchema<T>,
): T | null {
  if (jsonCache.has(filePath)) return (jsonCache.get(filePath) as T | null) ?? null;
  if (!fs.existsSync(filePath)) {
    jsonCache.set(filePath, null);
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    jsonCache.set(filePath, null);
    return null;
  }
  const parsed = JSON.parse(raw) as unknown;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid config at "${filePath}": ${issues}`);
  }
  jsonCache.set(filePath, result.data);
  return result.data;
}

function loadDefaults(): DefaultsFile | null {
  return loadJsonFile("providers/defaults.json", DefaultsFileSchema);
}

function loadAgents(): AgentsFile | null {
  return loadJsonFile("providers/agents.json", AgentsFileSchema);
}

function loadProvider(provider: string): ProviderFile | null {
  return loadJsonFile(`providers/${provider}.json`, ProviderFileSchema);
}

function pickApiKey(
  obj: { apiKey?: string } | null | undefined,
): string | undefined {
  return obj?.apiKey?.trim() || undefined;
}

export function getProviderConfigForAgent(agentName: string): ProviderConfig {
  const defaultsFile = loadDefaults();
  if (!defaultsFile) {
    throw new Error('Missing required config file: providers/defaults.json');
  }

  const baseProvider = defaultsFile.provider;
  const baseModelId = defaultsFile.modelId;

  const baseProviderFile = loadProvider(baseProvider);
  if (!baseProviderFile) {
    throw new Error(`Missing provider config: providers/${baseProvider}.json`);
  }
  const baseApiKey = baseProviderFile.apiKey.trim();

  const agentOverride = loadAgents()?.agents?.[agentName];
  if (!agentOverride) {
    return {
      provider: baseProvider,
      modelId: baseModelId,
      apiKey: baseApiKey,
      baseUrl: baseProviderFile.baseUrl,
      headers: baseProviderFile.headers,
    };
  }

  const overrideApiKey = pickApiKey(agentOverride);
  const overrideProviderFile = loadProvider(agentOverride.provider);
  if (!overrideProviderFile) {
    throw new Error(
      `Missing provider config: providers/${agentOverride.provider}.json`,
    );
  }
  const providerApiKey = overrideProviderFile.apiKey.trim();

  return {
    provider: agentOverride.provider,
    modelId: agentOverride.modelId,
    apiKey: (overrideApiKey ?? providerApiKey).trim(),
    baseUrl: overrideProviderFile.baseUrl,
    headers: overrideProviderFile.headers,
  };
}

export function resolveModel(cfg: {
  provider: string;
  modelId: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}): Model<any> {
  const { provider, modelId } = cfg;
  const model = getModel(provider as never, modelId as never) as
    | Model<any>
    | undefined;

  if (!model) {
    throw new Error(
      `Failed to resolve model for provider "${provider}" and model "${modelId}". ` +
        `Check providers/ configuration.`,
    );
  }

  return {
    ...model,
    baseUrl: cfg.baseUrl ?? model.baseUrl,
    headers: cfg.headers ?? model.headers,
  };
}

