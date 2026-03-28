import path from 'node:path'
import fs from 'fs-extra'
import { createJiti } from 'jiti'

export interface TokenMap {
  [key: string]: string
}

/**
 * Recursively flattens nested token object into CSS var map.
 * { brand: { 50: '#f0f9ff' } } → { '--color-brand-50': '#f0f9ff' }
 */
export function flattenTokens(obj: Record<string, any>, prefix = '--color'): TokenMap {
  const result: TokenMap = {}

  for (const [key, value] of Object.entries(obj)) {
    const kebabKey = toKebabCase(String(key))
    const varName = `${prefix}-${kebabKey}`

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenTokens(value as Record<string, any>, varName)
      Object.assign(result, nested)
    } else {
      result[varName] = String(value)
    }
  }

  return result
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * Loads a token file using jiti (handles TS imports at runtime).
 */
export async function loadTokenFile(
  filePath: string,
  exportName: string,
): Promise<Record<string, any> | null> {
  if (!(await fs.pathExists(filePath))) {
    return null
  }

  try {
    const jiti = createJiti(filePath, { interopDefault: true })
    const mod = await jiti.import(filePath)
    const exported = (mod as Record<string, any>)[exportName]
    if (exported && typeof exported === 'object') {
      return exported as Record<string, any>
    }
    return null
  } catch {
    return null
  }
}

/**
 * Resolves which token file to use based on config.mode and returns a flattened TokenMap.
 */
export async function resolveTokenSource(cwd: string, mode: string): Promise<TokenMap | null> {
  if (mode === 'tailwind' || mode === 'tailwind+shadcn') {
    const colorsPath = path.join(cwd, 'tokens', 'colors.ts')
    const colors = await loadTokenFile(colorsPath, 'colors')
    if (!colors) return null
    return flattenTokens(colors, '--color')
  }

  if (mode === 'css') {
    const indexPath = path.join(cwd, 'tokens', 'index.ts')
    const tokens = await loadTokenFile(indexPath, 'tokens')
    if (!tokens) return null
    // For tokens/index.ts: { colors: { primary: '...' } } → --color-primary
    const result: TokenMap = {}
    for (const [groupKey, groupValue] of Object.entries(tokens)) {
      if (groupValue !== null && typeof groupValue === 'object' && !Array.isArray(groupValue)) {
        // Use group key as the prefix root (e.g., colors → --color)
        const prefix = `--${toKebabCase(String(groupKey)).replace(/s$/, '')}`
        const flattened = flattenTokens(groupValue as Record<string, any>, prefix)
        Object.assign(result, flattened)
      }
    }
    return Object.keys(result).length > 0 ? result : null
  }

  return null
}
