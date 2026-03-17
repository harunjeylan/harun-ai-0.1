import { getModels, getProviders } from "@mariozechner/pi-ai";

export function listPiProviders(): string[] {
  return getProviders();
}

export function listPiModels(provider: string): string[] {
  const models = getModels(provider as never);
  return models.map((m) => m.id);
}
