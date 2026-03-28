import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'node:path'
import { CONSUMER_CONFIG } from '../core/constants.js'
import { getOrFetchRegistry } from '../core/registry-cache.js'
import { searchComponents } from '../core/search.js'
import { readLockfile } from '../core/lockfile.js'
import type { ConsumerConfig, RegistryComponent } from '../core/types.js'

interface OutputRow {
  name: string
  category: string
  description: string
  version: string
  installed: boolean
  installedVersion: string | undefined
}

function buildRow(
  comp: RegistryComponent,
  registryVersion: string,
  lockComponents: Record<string, { version: string }>
): OutputRow {
  const lockEntry = lockComponents[comp.name]
  return {
    name: comp.name,
    category: comp.category,
    description: comp.description,
    version: registryVersion,
    installed: !!lockEntry,
    installedVersion: lockEntry?.version,
  }
}

function printRows(rows: OutputRow[]): void {
  if (rows.length === 0) {
    console.log('No components found.')
    return
  }

  const isTTY = process.stdout.isTTY

  if (!isTTY) {
    // Clean output for piped usage
    for (const row of rows) {
      const status = row.installed ? `v${row.installedVersion} installed` : '(not installed)'
      console.log(`${row.name}\t${row.category}\t${row.description}\t${status}`)
    }
    return
  }

  const nameWidth = Math.max(10, ...rows.map((r) => r.name.length)) + 2
  const catWidth = Math.max(10, ...rows.map((r) => r.category.length)) + 2
  const descWidth = Math.max(20, ...rows.map((r) => r.description.length)) + 2

  console.log('')
  console.log(
    chalk.bold(
      '  ' +
        'Name'.padEnd(nameWidth) +
        'Category'.padEnd(catWidth) +
        'Description'.padEnd(descWidth) +
        'Status'
    )
  )
  console.log('  ' + '─'.repeat(nameWidth + catWidth + descWidth + 20))

  for (const row of rows) {
    const status = row.installed
      ? chalk.green(`v${row.installedVersion} ✓ installed`)
      : chalk.dim('(not installed)')
    console.log(
      '  ' +
        chalk.cyan(row.name.padEnd(nameWidth)) +
        row.category.padEnd(catWidth) +
        row.description.padEnd(descWidth) +
        status
    )
  }

  console.log('')
}

export const searchCommand = new Command('search')
  .description('Search for components by name, description, or category')
  .argument('<query>', 'Search query')
  .option('--json', 'Output as JSON')
  .option('--no-fetch', 'Skip remote refresh, use cached registry only')
  .action(async (query: string, opts: { json?: boolean; fetch: boolean }) => {
    const cwd = process.cwd()
    const configPath = path.join(cwd, CONSUMER_CONFIG)

    if (!(await fs.pathExists(configPath))) {
      if (opts.json) {
        console.log(JSON.stringify({ error: `No ${CONSUMER_CONFIG} found. Run blokos connect <url> first.` }))
      } else {
        console.error(chalk.red(`No ${CONSUMER_CONFIG} found. Run \`blokos connect <url>\` first.`))
      }
      process.exit(1)
    }

    const config: ConsumerConfig = await fs.readJson(configPath)
    const lock = await readLockfile(cwd)
    const forceRefresh = !opts.fetch

    const rows: OutputRow[] = []

    for (const reg of config.registries) {
      try {
        const registry = await getOrFetchRegistry(cwd, reg, forceRefresh)
        const matches = searchComponents(registry.components, query)
        for (const comp of matches) {
          rows.push(buildRow(comp, registry.version, lock.components))
        }
      } catch (err) {
        if (!opts.json) {
          console.warn(chalk.yellow(`  Warning: could not fetch ${reg.name}: ${err}`))
        }
      }
    }

    if (opts.json || !process.stdout.isTTY) {
      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2))
        return
      }
    }

    printRows(rows)
  })
