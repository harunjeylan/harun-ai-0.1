import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type LatestArtifacts = {
  markdownPath?: string;
  pdfPath?: string;
};

export function outputsDir(): string {
  return join(process.cwd(), "outputs");
}

export function latestArtifactsPath(): string {
  return join(outputsDir(), ".harunai-lateston");
}

export async function readLatestArtifacts(): Promise<LatestArtifacts> {
  try {
    const raw = await readFile(latestArtifactsPath(), "utf8");
    const parsed = JSON.parse(raw) as LatestArtifacts;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeLatestArtifacts(
  patch: LatestArtifacts,
): Promise<void> {
  const dir = outputsDir();
  await mkdir(dir, { recursive: true });
  const cur = await readLatestArtifacts();
  const next: LatestArtifacts = { ...cur, ...patch };
  await writeFile(
    latestArtifactsPath(),
    JSON.stringify(next, null, 2) + "\n",
    "utf8",
  );
}

export async function findLatestByExt(
  dir: string,
  ext: string,
): Promise<string | null> {
  const { readdir, stat } = await import("node:fs/promises");
  const entries = await readdir(dir);
  const files = entries
    .filter((e) => e.toLowerCase().endsWith(ext.toLowerCase()))
    .map((e) => join(dir, e));
  if (files.length === 0) return null;

  let latest = files[0]!;
  let latestMtime = (await stat(latest)).mtimeMs;
  for (const p of files.slice(1)) {
    const m = (await stat(p)).mtimeMs;
    if (m > latestMtime) {
      latestMtime = m;
      latest = p;
    }
  }
  return latest;
}
