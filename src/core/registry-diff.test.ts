import { describe, it, expect } from 'vitest'
import { diffRegistries } from './registry-diff.js'
import type { RegistryComponent } from './types.js'

function makeComponent(overrides: Partial<RegistryComponent> = {}): RegistryComponent {
  return {
    name: 'TestComponent',
    description: 'A test component',
    category: 'ui',
    files: ['components/test/index.tsx'],
    schema: {},
    dependencies: [],
    examples: [],
    ...overrides,
  }
}

describe('diffRegistries', () => {
  it('marks all components as new when no old registry exists', () => {
    const newComponents = {
      Button: makeComponent({ name: 'Button' }),
      Card: makeComponent({ name: 'Card' }),
    }
    const diff = diffRegistries(undefined, newComponents)
    expect(diff).toHaveLength(2)
    expect(diff.every((d) => d.status === 'new')).toBe(true)
    expect(diff.map((d) => d.name).sort()).toEqual(['Button', 'Card'])
  })

  it('marks component as new when it does not exist in old registry', () => {
    const old = { Button: makeComponent({ name: 'Button' }) }
    const next = {
      Button: makeComponent({ name: 'Button' }),
      Card: makeComponent({ name: 'Card' }),
    }
    const diff = diffRegistries(old, next)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({ name: 'Card', status: 'new' })
  })

  it('marks component as removed when absent from new registry', () => {
    const old = {
      Button: makeComponent({ name: 'Button' }),
      OldCard: makeComponent({ name: 'OldCard' }),
    }
    const next = { Button: makeComponent({ name: 'Button' }) }
    const diff = diffRegistries(old, next)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({ name: 'OldCard', status: 'removed' })
  })

  it('marks component as modified when description changed', () => {
    const old = { Button: makeComponent({ name: 'Button', description: 'old desc' }) }
    const next = { Button: makeComponent({ name: 'Button', description: 'new desc' }) }
    const diff = diffRegistries(old, next)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({ name: 'Button', status: 'modified' })
  })

  it('marks component as modified when dependencies changed', () => {
    const old = { Button: makeComponent({ name: 'Button', dependencies: [] }) }
    const next = { Button: makeComponent({ name: 'Button', dependencies: ['react-icons'] }) }
    const diff = diffRegistries(old, next)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({ name: 'Button', status: 'modified' })
  })

  it('marks component as modified when examples changed', () => {
    const old = { Button: makeComponent({ name: 'Button', examples: [] }) }
    const next = {
      Button: makeComponent({
        name: 'Button',
        examples: [{ description: 'Primary', props: { variant: 'primary' } }],
      }),
    }
    const diff = diffRegistries(old, next)
    expect(diff).toHaveLength(1)
    expect(diff[0]).toEqual({ name: 'Button', status: 'modified' })
  })

  it('returns empty array when nothing changed', () => {
    const component = makeComponent({ name: 'Button' })
    const diff = diffRegistries({ Button: component }, { Button: { ...component } })
    expect(diff).toHaveLength(0)
  })

  it('handles mixed new, modified, and removed in one diff', () => {
    const old = {
      Button: makeComponent({ name: 'Button', description: 'old' }),
      OldCard: makeComponent({ name: 'OldCard' }),
    }
    const next = {
      Button: makeComponent({ name: 'Button', description: 'new' }),
      PricingTable: makeComponent({ name: 'PricingTable' }),
    }
    const diff = diffRegistries(old, next)
    const byName = Object.fromEntries(diff.map((d) => [d.name, d.status]))
    expect(byName['Button']).toBe('modified')
    expect(byName['OldCard']).toBe('removed')
    expect(byName['PricingTable']).toBe('new')
  })

  it('returns empty array when both registries are empty', () => {
    const diff = diffRegistries({}, {})
    expect(diff).toHaveLength(0)
  })
})
