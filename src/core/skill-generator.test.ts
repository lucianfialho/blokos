import { describe, it, expect } from 'vitest'
import { generateSkill, generateConsumerSkill } from './skill-generator.js'
import type { RegistryJson, RegistryEntry, InstalledComponent } from './types.js'

function makeRegistry(overrides: Partial<RegistryJson> = {}): RegistryJson {
  return {
    name: 'My Registry',
    version: '1.0.0',
    description: 'A test registry',
    framework: 'react',
    components: {
      Button: {
        name: 'Button',
        description: 'A button component',
        category: 'ui',
        files: ['components/button/index.tsx'],
        schema: {
          properties: {
            variant: { type: 'string', enum: ['primary', 'secondary'], description: 'Button variant' },
            disabled: { type: 'boolean', description: 'Disable the button' },
          },
          required: ['variant'],
        },
        dependencies: ['clsx'],
        examples: [
          { description: 'Primary button', props: { variant: 'primary' } },
        ],
      },
    },
    ...overrides,
  }
}

function makeRegistries(): RegistryEntry[] {
  return [
    { name: 'my-registry', url: 'https://registry.example.com' },
    { name: 'other-registry', url: 'https://other.example.com' },
  ]
}

function makeInstalled(): Record<string, InstalledComponent> {
  return {
    Button: { name: 'Button', registry: 'my-registry', version: '1.2.0', files: ['button.tsx'] },
    Card: { name: 'Card', registry: 'my-registry', files: ['card.tsx'] },
  }
}

describe('generateSkill (author-side)', () => {
  it('includes registry name and description', () => {
    const registry = makeRegistry()
    const skill = generateSkill(registry)
    expect(skill).toContain('My Registry')
    expect(skill).toContain('A test registry')
  })

  it('includes component names and props tables', () => {
    const registry = makeRegistry()
    const skill = generateSkill(registry)
    expect(skill).toContain('Button')
    expect(skill).toContain('variant')
    expect(skill).toContain('disabled')
  })

  it('includes examples', () => {
    const registry = makeRegistry()
    const skill = generateSkill(registry)
    expect(skill).toContain('Primary button')
    expect(skill).toContain('<Button')
  })

  it('includes overrides when provided', () => {
    const registry = makeRegistry()
    const skill = generateSkill(registry, 'Custom composition rules here.')
    expect(skill).toContain('Custom composition rules here.')
    expect(skill).toContain('Composition Rules')
  })
})

describe('generateConsumerSkill', () => {
  it('contains the TRIGGER line', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    expect(skill).toContain('TRIGGER when:')
  })

  it('contains blokos CLI discovery commands', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    expect(skill).toContain('blokos list --json')
    expect(skill).toContain('blokos get <name> --json')
    expect(skill).toContain('blokos search "<query>" --json')
    expect(skill).toContain('blokos suggest "<phrase>" --json')
  })

  it('contains blokos CLI install commands', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    expect(skill).toContain('blokos add <name>')
    expect(skill).toContain('blokos update --all')
    expect(skill).toContain('blokos outdated')
  })

  it('lists all connected registries with URLs', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    expect(skill).toContain('my-registry')
    expect(skill).toContain('https://registry.example.com')
    expect(skill).toContain('other-registry')
    expect(skill).toContain('https://other.example.com')
  })

  it('lists installed components with count', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    expect(skill).toContain('Installed Components (2)')
    expect(skill).toContain('Button')
    expect(skill).toContain('Card')
  })

  it('shows version for components that have it', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    expect(skill).toContain('1.2.0')
  })

  it('shows empty state when no components installed', () => {
    const skill = generateConsumerSkill(makeRegistries(), {}, 'My Design System', 'Test description')
    expect(skill).toContain('Installed Components (0)')
    expect(skill).toContain('blokos add <name>')
  })

  it('does NOT contain verbose props tables', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    // Props tables have this header pattern from generateSkill
    expect(skill).not.toContain('| Prop | Type | Required | Description |')
    expect(skill).not.toContain('**Props:**')
  })

  it('does NOT contain component examples JSX', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    // Author skill renders <Button variant="primary" /> style examples
    expect(skill).not.toContain('<Button')
  })

  it('includes frontmatter with type: project', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'My Design System', 'Test description')
    expect(skill).toContain('type: project')
  })

  it('uses provided registryName and description', () => {
    const skill = generateConsumerSkill(makeRegistries(), makeInstalled(), 'Acme UI', 'Acme component library.')
    expect(skill).toContain('Acme UI')
    expect(skill).toContain('Acme component library.')
  })
})
