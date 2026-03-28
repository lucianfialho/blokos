import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'node:path'
import { CONFIG_FILE, COMPONENTS_DIR, META_FILE, SCHEMA_FILE } from '../core/constants.js'
import { toPascalCase } from '../utils/helpers.js'
import { loadConfig } from '../core/registry-builder.js'
import type { BlokosConfig } from '../core/types.js'

type Category = 'atom' | 'molecule' | 'organism' | 'template'

function getComponentTemplate(pascalName: string, name: string, mode: BlokosConfig['mode']): string {
  if (mode === 'css') {
    return `// Available tokens: import from tokens/index.ts
// e.g. var(--color-primary), var(--color-background)
interface ${pascalName}Props {
  label: string
}

export function ${pascalName}({ label }: ${pascalName}Props) {
  return (
    <button style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '0.5rem 1rem' }}>
      {label}
    </button>
  )
}
`
  }

  if (mode === 'tailwind+shadcn') {
    return `// Available tokens: use shadcn CSS vars
// e.g. bg-primary, text-primary-foreground, border-border
interface ${pascalName}Props {
  label: string
}

export function ${pascalName}({ label }: ${pascalName}Props) {
  return (
    <button className="bg-primary text-primary-foreground px-4 py-2 rounded">
      {label}
    </button>
  )
}
`
  }

  // default: tailwind
  return `// Available tokens: use Tailwind classes from tailwind.config.ts
// e.g. bg-brand-500, text-brand-900
interface ${pascalName}Props {
  label: string
}

export function ${pascalName}({ label }: ${pascalName}Props) {
  return (
    <button className="bg-brand-500 text-white px-4 py-2 rounded">
      {label}
    </button>
  )
}
`
}

export const createCommand = new Command('create')
  .description('Scaffold a new component')
  .argument('<name>', 'Component name in kebab-case (e.g. hero-section)')
  .option('--atom', 'Set category to atom (default)')
  .option('--molecule', 'Set category to molecule')
  .option('--organism', 'Set category to organism')
  .option('--template', 'Set category to template')
  .action(async (name: string, options: { atom?: boolean; molecule?: boolean; organism?: boolean; template?: boolean }) => {
    const cwd = process.cwd()

    if (!(await fs.pathExists(path.join(cwd, CONFIG_FILE)))) {
      console.log(chalk.red('No blokos registry found. Run `blokos init` first.'))
      process.exit(1)
    }

    // Determine category from flags; default is 'atom'
    let category: Category = 'atom'
    if (options.organism) category = 'organism'
    else if (options.molecule) category = 'molecule'
    else if (options.template) category = 'template'
    else if (options.atom) category = 'atom'

    // Load config to read mode for token hints
    const config = await loadConfig(cwd)

    const componentDir = path.join(cwd, COMPONENTS_DIR, name)

    if (await fs.pathExists(componentDir)) {
      console.log(chalk.yellow(`Component "${name}" already exists.`))
      return
    }

    const spinner = ora(`Creating ${name}...`).start()

    const pascalName = toPascalCase(name)

    await fs.ensureDir(componentDir)

    // schema.ts
    const schemaContent = `import { z } from 'zod'

export const ${pascalName.charAt(0).toLowerCase() + pascalName.slice(1)}Schema = z.object({
  title: z.string().describe('Main title'),
})
`
    await fs.writeFile(path.join(componentDir, SCHEMA_FILE), schemaContent)

    // component.tsx
    const componentContent = getComponentTemplate(pascalName, name, config.mode)
    await fs.writeFile(path.join(componentDir, `${name}.tsx`), componentContent)

    // meta.json
    const meta = {
      name: pascalName,
      description: `${pascalName} component`,
      category,
      slots: [],
      dependencies: [],
      examples: [
        {
          description: 'Default',
          props: { label: `Example ${pascalName}` },
        },
      ],
    }
    await fs.writeJson(path.join(componentDir, META_FILE), meta, { spaces: 2 })

    spinner.succeed(`Component ${chalk.cyan(pascalName)} created!`)

    console.log('')
    console.log(`  ${chalk.green(`${COMPONENTS_DIR}/${name}/${name}.tsx`)} — component`)
    console.log(`  ${chalk.green(`${COMPONENTS_DIR}/${name}/${SCHEMA_FILE}`)} — props schema`)
    console.log(`  ${chalk.green(`${COMPONENTS_DIR}/${name}/${META_FILE}`)} — metadata`)
    console.log('')
    console.log(`Edit the files, then run ${chalk.cyan('blokos publish')}`)
  })
