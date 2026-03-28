import fs from 'fs-extra'
import path from 'node:path'
import { fetchRegistry } from './registry-fetcher.js'
import type { RegistryJson, RegistryEntry } from './types.js'

export interface CachedRegistry {
  fetchedAt: string // ISO timestamp
  registry: RegistryJson
}

const CACHE_DIR = '.blokos/cache'
export const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour

function cachePath(cwd: string, registryName: string): string {
  return path.join(cwd, CACHE_DIR, `${registryName}.json`)
}

export async function getCachedRegistry(
  cwd: string,
  registryName: string
): Promise<CachedRegistry | null> {
  const file = cachePath(cwd, registryName)
  if (!(await fs.pathExists(file))) return null
  try {
    return (await fs.readJson(file)) as CachedRegistry
  } catch {
    return null
  }
}

export async function setCachedRegistry(
  cwd: string,
  registryName: string,
  registry: RegistryJson
): Promise<void> {
  const file = cachePath(cwd, registryName)
  await fs.ensureDir(path.dirname(file))
  const cached: CachedRegistry = {
    fetchedAt: new Date().toISOString(),
    registry,
  }
  await fs.writeJson(file, cached, { spaces: 2 })
}

export function isCacheStale(cachedAt: string, ttlMs: number = DEFAULT_TTL_MS): boolean {
  const age = Date.now() - new Date(cachedAt).getTime()
  return age > ttlMs
}

export async function getOrFetchRegistry(
  cwd: string,
  entry: RegistryEntry,
  forceRefresh = false
): Promise<RegistryJson> {
  if (!forceRefresh) {
    const cached = await getCachedRegistry(cwd, entry.name)
    if (cached && !isCacheStale(cached.fetchedAt)) {
      return cached.registry
    }
  }

  const token = process.env[`BLOKOS_TOKEN_${entry.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]
  const registry = await fetchRegistry(entry.url, token)
  await setCachedRegistry(cwd, entry.name, registry)
  return registry
}
