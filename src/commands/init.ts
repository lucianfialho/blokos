import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import prompts from 'prompts'
import fs from 'fs-extra'
import path from 'node:path'
import { execSync } from 'node:child_process'
import {
  CONFIG_FILE,
  REGISTRY_FILE,
  COMPONENTS_DIR,
  SKILL_DIR,
} from '../core/constants.js'
import type { BlokosConfig } from '../core/types.js'

type Mode = BlokosConfig['mode']

const TAILWIND_CONFIG_CONTENT = `import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // brand: { 50: '#f0f9ff', 500: '#0ea5e9', 900: '#0c4a6e' },
        // semantic: { primary: 'var(--color-brand-500)' }
      },
    },
  },
}

export default config
`

const TOKENS_COLORS_CONTENT = `export const colors = {
  brand: {
    50: '#f0f9ff',
    500: '#0ea5e9',
    900: '#0c4a6e',
  },
  semantic: {
    primary: 'var(--color-brand-500)',
    background: 'var(--color-brand-50)',
  },
}
`

const TOKENS_INDEX_CONTENT = `export const tokens = {
  colors: {
    primary: '#0ea5e9',
    background: '#f0f9ff',
    foreground: '#0c4a6e',
  },
  spacing: {
    sm: '0.5rem',
    md: '1rem',
    lg: '2rem',
  },
  typography: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: { sm: '0.875rem', base: '1rem', lg: '1.125rem' },
  },
}
`

export const initCommand = new Command('init')
  .description('Initialize a new component registry')
  .option('-n, --name <name>', 'Registry name')
  .option('-d, --description <desc>', 'Registry description')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .option('--shadcn', 'Use Tailwind + shadcn mode')
  .option('--vanilla', 'Use pure CSS vars mode (no Tailwind)')
  .action(async (options) => {
    const cwd = process.cwd()

    if (await fs.pathExists(path.join(cwd, CONFIG_FILE))) {
      console.log(chalk.yellow('Registry already initialized in this directory.'))
      return
    }

    // Determine mode from flags
    let mode: Mode = 'tailwind'
    if (options.shadcn) mode = 'tailwind+shadcn'
    else if (options.vanilla) mode = 'css'

    let name = options.name || path.basename(cwd)
    let description = options.description || ''

    if (!options.yes) {
      const answers = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Registry name',
          initial: name,
        },
        {
          type: 'text',
          name: 'description',
          message: 'Description',
          initial: description,
        },
      ])
      name = answers.name || name
      description = answers.description || description
    }

    const spinner = ora('Initializing registry...').start()

    // Create directories
    await fs.ensureDir(path.join(cwd, COMPONENTS_DIR))
    await fs.ensureDir(path.join(cwd, SKILL_DIR))

    // Create blokos.config.ts
    const configContent = `import type { BlokosConfig } from 'blokos'

const config: BlokosConfig = {
  name: '${name}',
  description: '${description}',
  framework: 'react',
  mode: '${mode}',
}

export default config
`
    await fs.writeFile(path.join(cwd, CONFIG_FILE), configContent)

    // Create empty registry.json
    const registry = {
      name,
      version: '1.0.0',
      description,
      framework: 'react',
      components: {},
    }
    await fs.writeJson(path.join(cwd, REGISTRY_FILE), registry, { spaces: 2 })

    // Scaffold mode-specific files
    if (mode === 'tailwind' || mode === 'tailwind+shadcn') {
      await fs.writeFile(path.join(cwd, 'tailwind.config.ts'), TAILWIND_CONFIG_CONTENT)
      await fs.ensureDir(path.join(cwd, 'tokens'))
      await fs.writeFile(path.join(cwd, 'tokens', 'colors.ts'), TOKENS_COLORS_CONTENT)
    } else if (mode === 'css') {
      await fs.ensureDir(path.join(cwd, 'tokens'))
      await fs.writeFile(path.join(cwd, 'tokens', 'index.ts'), TOKENS_INDEX_CONTENT)
    }

    spinner.succeed('Registry initialized!')

    console.log('')
    console.log(`  ${chalk.green(CONFIG_FILE)} — registry config`)
    console.log(`  ${chalk.green(REGISTRY_FILE)} — component index`)
    console.log(`  ${chalk.green(COMPONENTS_DIR + '/')} — your components`)
    console.log(`  ${chalk.green(SKILL_DIR + '/')} — generated AI skills`)

    if (mode === 'tailwind' || mode === 'tailwind+shadcn') {
      console.log(`  ${chalk.green('tailwind.config.ts')} — Tailwind config`)
      console.log(`  ${chalk.green('tokens/colors.ts')} — color tokens`)
    } else if (mode === 'css') {
      console.log(`  ${chalk.green('tokens/index.ts')} — CSS token exports`)
    }

    if (mode === 'tailwind+shadcn') {
      console.log('')
      const installSpinner = ora('Installing shadcn dependencies...').start()
      try {
        execSync(
          'npm install @radix-ui/react-slot class-variance-authority clsx tailwind-merge',
          { cwd, stdio: 'ignore' }
        )
        installSpinner.succeed('shadcn dependencies installed')
      } catch {
        installSpinner.fail('Could not install shadcn dependencies — run manually:')
        console.log(
          chalk.cyan(
            '  npm install @radix-ui/react-slot class-variance-authority clsx tailwind-merge'
          )
        )
      }
    }

    console.log('')
    console.log(`Next: ${chalk.cyan('blokos create <component-name>')}`)
  })
