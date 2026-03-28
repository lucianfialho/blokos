import { describe, it, expect } from 'vitest'
import { searchComponents, suggestComponents } from './search.js'
import type { RegistryComponent } from './types.js'

function makeComponent(overrides: Partial<RegistryComponent> & { name: string }): RegistryComponent {
  return {
    name: overrides.name,
    description: overrides.description ?? '',
    category: overrides.category ?? 'atom',
    files: overrides.files ?? [],
    schema: overrides.schema ?? {},
    dependencies: overrides.dependencies ?? [],
    examples: overrides.examples ?? [],
  }
}

const components: Record<string, RegistryComponent> = {
  Button: makeComponent({ name: 'Button', description: 'A clickable button', category: 'atom' }),
  HeroSection: makeComponent({ name: 'HeroSection', description: 'Full-width hero section', category: 'organism' }),
  DataTable: makeComponent({ name: 'DataTable', description: 'Table with sorting and filtering', category: 'molecule' }),
  PricingCard: makeComponent({ name: 'PricingCard', description: 'Pricing plan card', category: 'molecule' }),
  NavBar: makeComponent({ name: 'NavBar', description: 'Top navigation bar', category: 'organism' }),
}

describe('searchComponents', () => {
  it('matches by name (partial, case-insensitive)', () => {
    const results = searchComponents(components, 'button')
    expect(results.map((r) => r.name)).toContain('Button')
  })

  it('matches by description', () => {
    const results = searchComponents(components, 'sorting')
    expect(results.map((r) => r.name)).toContain('DataTable')
  })

  it('matches by category', () => {
    const results = searchComponents(components, 'organism')
    const names = results.map((r) => r.name)
    expect(names).toContain('HeroSection')
    expect(names).toContain('NavBar')
  })

  it('returns empty array when nothing matches', () => {
    const results = searchComponents(components, 'nonexistent-xyz')
    expect(results).toEqual([])
  })

  it('is case-insensitive', () => {
    const results = searchComponents(components, 'PRICING')
    expect(results.map((r) => r.name)).toContain('PricingCard')
  })

  it('matches partial name', () => {
    const results = searchComponents(components, 'hero')
    expect(results.map((r) => r.name)).toContain('HeroSection')
  })

  it('returns all components when query is an empty string (matches everything)', () => {
    const results = searchComponents(components, '')
    expect(results.length).toBe(Object.keys(components).length)
  })
})

describe('suggestComponents', () => {
  it('tokenizes phrase and matches each token', () => {
    const results = suggestComponents(components, 'table with sorting')
    expect(results.map((r) => r.name)).toContain('DataTable')
  })

  it('returns results from multiple tokens (OR logic)', () => {
    const results = suggestComponents(components, 'button hero')
    const names = results.map((r) => r.name)
    expect(names).toContain('Button')
    expect(names).toContain('HeroSection')
  })

  it('deduplicates results', () => {
    // "nav" matches NavBar once; make sure it only appears once
    const results = suggestComponents(components, 'nav bar navigation')
    const navBars = results.filter((r) => r.name === 'NavBar')
    expect(navBars.length).toBe(1)
  })

  it('returns empty array for empty phrase', () => {
    const results = suggestComponents(components, '')
    expect(results).toEqual([])
  })

  it('returns empty array for whitespace-only phrase', () => {
    const results = suggestComponents(components, '   ')
    expect(results).toEqual([])
  })

  it('ignores tokens that do not match anything', () => {
    const results = suggestComponents(components, 'nonexistent button')
    expect(results.map((r) => r.name)).toContain('Button')
  })
})
