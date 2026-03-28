import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import {
  getCachedRegistry,
  setCachedRegistry,
  isCacheStale,
  getOrFetchRegistry,
  DEFAULT_TTL_MS,
} from './registry-cache.js'
import type { RegistryJson, RegistryEntry } from './types.js'

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'blokos-cache-test-'))
}

const sampleRegistry: RegistryJson = {
  name: 'test-registry',
  version: '1.0.0',
  description: 'A test registry',
  framework: 'react',
  components: {
    Button: {
      name: 'Button',
      description: 'A button',
      category: 'atom',
      files: ['button.tsx'],
      schema: {},
      dependencies: [],
      examples: [],
    },
  },
}

describe('getCachedRegistry', () => {
  it('returns null when cache file does not exist', async () => {
    const cwd = makeTmpDir()
    const result = await getCachedRegistry(cwd, 'test-registry')
    expect(result).toBeNull()
    await fs.remove(cwd)
  })

  it('returns cached data when file exists', async () => {
    const cwd = makeTmpDir()
    await setCachedRegistry(cwd, 'test-registry', sampleRegistry)
    const result = await getCachedRegistry(cwd, 'test-registry')
    expect(result).not.toBeNull()
    expect(result?.registry).toEqual(sampleRegistry)
    await fs.remove(cwd)
  })

  it('returns null when cache file is malformed JSON', async () => {
    const cwd = makeTmpDir()
    await fs.ensureDir(path.join(cwd, '.blokos/cache'))
    await fs.writeFile(path.join(cwd, '.blokos/cache/bad-registry.json'), '{not valid json')
    const result = await getCachedRegistry(cwd, 'bad-registry')
    expect(result).toBeNull()
    await fs.remove(cwd)
  })
})

describe('setCachedRegistry', () => {
  it('writes cache file with fetchedAt timestamp', async () => {
    const cwd = makeTmpDir()
    await setCachedRegistry(cwd, 'my-reg', sampleRegistry)
    const cacheFile = path.join(cwd, '.blokos/cache/my-reg.json')
    expect(await fs.pathExists(cacheFile)).toBe(true)
    const data = await fs.readJson(cacheFile)
    expect(data.registry).toEqual(sampleRegistry)
    expect(typeof data.fetchedAt).toBe('string')
    expect(new Date(data.fetchedAt).getTime()).toBeGreaterThan(0)
    await fs.remove(cwd)
  })
})

describe('isCacheStale', () => {
  it('returns false when cache is fresh', () => {
    const recentTimestamp = new Date(Date.now() - 10_000).toISOString() // 10 seconds ago
    expect(isCacheStale(recentTimestamp, DEFAULT_TTL_MS)).toBe(false)
  })

  it('returns true when cache is older than TTL', () => {
    const oldTimestamp = new Date(Date.now() - DEFAULT_TTL_MS - 1000).toISOString()
    expect(isCacheStale(oldTimestamp, DEFAULT_TTL_MS)).toBe(true)
  })

  it('uses default TTL of 1 hour', () => {
    const justUnder1h = new Date(Date.now() - 59 * 60 * 1000).toISOString()
    expect(isCacheStale(justUnder1h)).toBe(false)

    const justOver1h = new Date(Date.now() - 61 * 60 * 1000).toISOString()
    expect(isCacheStale(justOver1h)).toBe(true)
  })
})

describe('getOrFetchRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns cached registry when cache is fresh', async () => {
    const cwd = makeTmpDir()
    await setCachedRegistry(cwd, 'test-registry', sampleRegistry)

    // Spy on fetchRegistry — should NOT be called
    const { fetchRegistry } = await import('./registry-fetcher.js')
    const fetchSpy = vi.spyOn({ fetchRegistry }, 'fetchRegistry')

    const entry: RegistryEntry = { name: 'test-registry', url: 'https://example.com' }
    const result = await getOrFetchRegistry(cwd, entry)
    expect(result).toEqual(sampleRegistry)

    fetchSpy.mockRestore()
    await fs.remove(cwd)
  })

  it('fetches and caches when cache is stale', async () => {
    const cwd = makeTmpDir()

    // Write a stale cache (2h ago)
    const staleCache = {
      fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      registry: { ...sampleRegistry, version: '0.0.1' },
    }
    await fs.ensureDir(path.join(cwd, '.blokos/cache'))
    await fs.writeJson(path.join(cwd, '.blokos/cache/test-registry.json'), staleCache)

    // Mock fetchRegistry
    const fetcherModule = await import('./registry-fetcher.js')
    vi.spyOn(fetcherModule, 'fetchRegistry').mockResolvedValue(sampleRegistry)

    const entry: RegistryEntry = { name: 'test-registry', url: 'https://example.com' }
    const result = await getOrFetchRegistry(cwd, entry)
    expect(result.version).toBe('1.0.0')

    // Verify new cache was written
    const cached = await getCachedRegistry(cwd, 'test-registry')
    expect(cached?.registry.version).toBe('1.0.0')

    vi.restoreAllMocks()
    await fs.remove(cwd)
  })

  it('fetches when forceRefresh is true even if cache is fresh', async () => {
    const cwd = makeTmpDir()
    await setCachedRegistry(cwd, 'test-registry', { ...sampleRegistry, version: '0.5.0' })

    const fetcherModule = await import('./registry-fetcher.js')
    vi.spyOn(fetcherModule, 'fetchRegistry').mockResolvedValue(sampleRegistry)

    const entry: RegistryEntry = { name: 'test-registry', url: 'https://example.com' }
    const result = await getOrFetchRegistry(cwd, entry, true)
    expect(result.version).toBe('1.0.0')

    vi.restoreAllMocks()
    await fs.remove(cwd)
  })
})
