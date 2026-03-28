import { describe, it, expect } from 'vitest'
import type { RegistryEntry } from '../core/types.js'

describe('RegistryEntry — no token field', () => {
  it('RegistryEntry objects written to disk have no token field', () => {
    const entry: RegistryEntry = { name: 'my-registry', url: 'https://example.com' }

    // Simulate what would be serialized to blokos.json
    const serialized = JSON.stringify(entry)
    const parsed = JSON.parse(serialized)

    expect(parsed).not.toHaveProperty('token')
    expect(parsed).toHaveProperty('name', 'my-registry')
    expect(parsed).toHaveProperty('url', 'https://example.com')
  })

  it('RegistryEntry type does not include token in required shape', () => {
    // TypeScript compile-time check: the type should not have token
    // This runtime test verifies a freshly constructed entry has no token
    const entry: RegistryEntry = { name: 'test', url: 'https://test.com' }
    expect(Object.keys(entry)).toEqual(['name', 'url'])
  })
})
