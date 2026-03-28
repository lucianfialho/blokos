import fs from 'fs-extra'
import type { RegistryJson, RegistryComponent, RegistryEntry, InstalledComponent } from './types.js'

/**
 * Generate a Claude Code skill markdown from a registry
 */
export function generateSkill(
  registry: RegistryJson,
  overrides?: string
): string {
  const lines: string[] = []

  lines.push(`# ${registry.name} — Component Library`)
  lines.push('')
  lines.push(`${registry.description}`)
  lines.push('')
  lines.push('TRIGGER when: user asks to create a page, section, layout, or component using this design system.')
  lines.push('')
  lines.push('## Rules')
  lines.push('')
  lines.push('- ONLY use components listed below. Do NOT invent new components.')
  lines.push('- Follow the prop types exactly as defined.')
  lines.push('- Import components from the paths shown.')
  lines.push('- Output native TSX code (Next.js pages/components), NOT JSON specs.')
  lines.push('')

  // Components section
  lines.push('## Available Components')
  lines.push('')

  const components = Object.values(registry.components)

  for (const comp of components) {
    lines.push(`### ${comp.name}`)
    lines.push('')
    lines.push(comp.description)
    lines.push('')
    lines.push(`**Category:** ${comp.category}`)
    lines.push('')

    // Props table from JSON Schema
    const propsTable = buildPropsTable(comp)
    if (propsTable) {
      lines.push('**Props:**')
      lines.push('')
      lines.push(propsTable)
      lines.push('')
    }

    // Examples
    if (comp.examples && comp.examples.length > 0) {
      lines.push('**Examples:**')
      lines.push('')
      for (const example of comp.examples) {
        if (!example.props) continue
        lines.push(`*${example.description}:*`)
        lines.push('```tsx')
        lines.push(buildExampleJsx(comp.name, example.props))
        lines.push('```')
        lines.push('')
      }
    }

    // Dependencies
    if (comp.dependencies.length > 0) {
      lines.push(`**Dependencies:** ${comp.dependencies.join(', ')}`)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  // Overrides section
  if (overrides) {
    lines.push('## Composition Rules')
    lines.push('')
    lines.push(overrides)
    lines.push('')
  }

  return lines.join('\n')
}

function buildPropsTable(comp: RegistryComponent): string | null {
  const schema = comp.schema as {
    properties?: Record<string, { type?: string; description?: string; enum?: string[] }>
    required?: string[]
  }

  if (!schema.properties) return null

  const rows: string[] = []
  rows.push('| Prop | Type | Required | Description |')
  rows.push('|------|------|----------|-------------|')

  const required = new Set(schema.required || [])

  for (const [name, prop] of Object.entries(schema.properties)) {
    const type = prop.enum ? prop.enum.map((e) => `"${e}"`).join(' | ') : prop.type || 'unknown'
    const req = required.has(name) ? 'Yes' : 'No'
    const desc = prop.description || ''
    rows.push(`| ${name} | ${type} | ${req} | ${desc} |`)
  }

  return rows.join('\n')
}

function buildExampleJsx(
  componentName: string,
  props: Record<string, unknown>
): string {
  const propsStr = Object.entries(props)
    .map(([key, value]) => {
      if (typeof value === 'string') return `${key}="${value}"`
      return `${key}={${JSON.stringify(value)}}`
    })
    .join(' ')

  return `<${componentName} ${propsStr} />`
}

/**
 * Generate a minimal consumer-side skill that teaches Claude HOW to use the CLI.
 * Claude fetches component details on-demand via `blokos get <name> --json`.
 */
export function generateConsumerSkill(
  registries: RegistryEntry[],
  installed: Record<string, InstalledComponent>,
  registryName: string,
  description: string
): string {
  const lines: string[] = []

  lines.push('---')
  lines.push(`name: ${registryName} Design System`)
  lines.push('description: Component library — use blokos CLI to discover and install components')
  lines.push('type: project')
  lines.push('---')
  lines.push('')
  lines.push(`# ${registryName} — Component Library`)
  lines.push('')
  lines.push(description)
  lines.push('')
  lines.push('TRIGGER when: user asks to build UI, create a page, or use a component from this design system.')
  lines.push('')
  lines.push('## Rules')
  lines.push('')
  lines.push('- ONLY use components from this registry. Do NOT invent components.')
  lines.push('- Run `blokos list --json` first to see what\'s available.')
  lines.push('- Run `blokos get <name> --json` to get props and examples before using a component.')
  lines.push('- Run `blokos add <name>` to install a component before importing it.')
  lines.push('')
  lines.push('## How to discover')
  lines.push('')
  lines.push('```bash')
  lines.push('blokos list --json              # all available components')
  lines.push('blokos get <name> --json        # props, examples, dependencies')
  lines.push('blokos search "<query>" --json  # find by description')
  lines.push('blokos suggest "<phrase>" --json  # keyword search')
  lines.push('```')
  lines.push('')
  lines.push('## How to install')
  lines.push('')
  lines.push('```bash')
  lines.push('blokos add <name>     # install component + update this skill')
  lines.push('blokos update --all   # update all installed components')
  lines.push('blokos outdated       # check for updates')
  lines.push('```')
  lines.push('')
  lines.push('## Connected Registries')
  lines.push('')
  for (const reg of registries) {
    lines.push(`- **${reg.name}**: ${reg.url}`)
  }
  lines.push('')

  const installedEntries = Object.values(installed)
  lines.push(`## Installed Components (${installedEntries.length})`)
  lines.push('')
  if (installedEntries.length === 0) {
    lines.push('_No components installed yet. Run `blokos add <name>` to install one._')
  } else {
    for (const comp of installedEntries) {
      const version = comp.version ? ` @ ${comp.version}` : ''
      lines.push(`- **${comp.name}**${version} (${comp.registry})`)
    }
  }
  lines.push('')

  return lines.join('\n')
}

/**
 * Load skill overrides from a file if it exists
 */
export async function loadSkillOverrides(filePath: string): Promise<string | undefined> {
  if (await fs.pathExists(filePath)) {
    return fs.readFile(filePath, 'utf-8')
  }
  return undefined
}
