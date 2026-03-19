/**
 * Deep merge utilities for hierarchical config
 */

/**
 * Deep merge two objects. Values from source override values from target.
 * Arrays are replaced entirely (not merged) unless specified.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
  options?: { mergeArrays?: boolean }
): T {
  const result = { ...target } as Record<string, unknown>;
  
  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key as keyof T];

    if (sourceValue === undefined) {
      continue;
    }

    if (
      targetValue !== undefined &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue) &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      sourceValue !== null
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        options
      );
    } else if (options?.mergeArrays && Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      // Merge arrays (concat + dedupe)
      result[key] = [...new Set([...targetValue, ...sourceValue])];
    } else {
      // Replace value
      result[key] = sourceValue;
    }
  }

  return result as T;
}

/**
 * Deep merge multiple objects. Later objects override earlier ones.
 */
export function deepMergeAll<T extends Record<string, unknown>>(
  ...objects: Array<T | undefined>
): T {
  let result: Record<string, unknown> = {};

  for (const obj of objects) {
    if (obj) {
      result = deepMerge(result as T, obj as Partial<T>);
    }
  }

  return result as T;
}

/**
 * Get a nested property from an object using dot notation
 */
export function getNestedValue<T = unknown>(
  obj: Record<string, unknown>,
  path: string,
  defaultValue?: T
): T | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return (current as T) ?? defaultValue;
}

/**
 * Set a nested property in an object using dot notation
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}
