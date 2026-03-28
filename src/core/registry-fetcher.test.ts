import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveToken } from './registry-fetcher.js'

describe('resolveToken', () => {
  beforeEach(() => {
    // Clean env before each test
    delete process.env.BLOKOS_TOKEN_MY_REGISTRY
    delete process.env.BLOKOS_TOKEN_MY_PRIVATE_REGISTRY
  })

  afterEach(() => {
    delete process.env.BLOKOS_TOKEN_MY_REGISTRY
    delete process.env.BLOKOS_TOKEN_MY_PRIVATE_REGISTRY
  })

  it('returns explicit token when provided', async () => {
    const token = await resolveToken('my-registry', 'explicit-token-123')
    expect(token).toBe('explicit-token-123')
  })

  it('falls back to env var when no explicit token', async () => {
    process.env.BLOKOS_TOKEN_MY_REGISTRY = 'env-token-abc'
    const token = await resolveToken('my-registry')
    expect(token).toBe('env-token-abc')
  })

  it('returns undefined when neither explicit token nor env var is set', async () => {
    const token = await resolveToken('my-registry')
    expect(token).toBeUndefined()
  })

  it('normalizes registry name to uppercase env key', async () => {
    process.env.BLOKOS_TOKEN_MY_PRIVATE_REGISTRY = 'private-token-xyz'
    const token = await resolveToken('my-private-registry')
    expect(token).toBe('private-token-xyz')
  })

  it('prefers explicit token over env var', async () => {
    process.env.BLOKOS_TOKEN_MY_REGISTRY = 'env-token'
    const token = await resolveToken('my-registry', 'explicit-token')
    expect(token).toBe('explicit-token')
  })

  it('replaces non-alphanumeric characters with underscores in env key', async () => {
    process.env['BLOKOS_TOKEN_MY_REGISTRY_V2'] = 'token-v2'
    const token = await resolveToken('my-registry.v2')
    expect(token).toBe('token-v2')
    delete process.env['BLOKOS_TOKEN_MY_REGISTRY_V2']
  })
})
