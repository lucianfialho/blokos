import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'node:path'
import { CONSUMER_CONFIG } from '../core/constants.js'
import { getOrFetchRegistry } from '../core/registry-cache.js'
import { readLockfile } from '../core/lockfile.js'
import type { ConsumerConfig } from '../core/types.js'

interface OutputRow {
  name: string
  category: string
  description: string
  registry: string
  version: string
  installed: boolean
  installedVersion: string | undefined
}

export const listCommand = new Command('list')
  .description('List available and installed components')
  .option('--json', 'Output as JSON')
  .option('--no-fetch', 'Skip remote refresh, use cached registry only')
  .action(async (opts: { json?: boolean; fetch: boolean }) => {
    const cwd = process.cwd()
    const configPath = path.join(cwd, CONSUMER_CONFIG)
    const isTTY = process.stdout.isTTY

    if (!(await fs.pathExists(configPath))) {
      if (opts.json) {
        console.log(JSON.stringify({ error: `No ${CONSUMER_CONFIG} found. Run blokos connect <url> first.` }))
      } else {
        console.log(chalk.red(`No ${CONSUMER_CONFIG} found. Run \`blokos connect <url>\` first.`))
      }
      process.exit(1)
    }

    const config: ConsumerConfig = await fs.readJson(configPath)

    if (config.registries.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify([]))
      } else {
        console.log(chalk.yellow('No registries connected.'))
      }
      return
    }

    const spinner = isTTY && !opts.json ? ora('Fetching registries...').start() : null
    const lock = await readLockfile(cwd)
    const forceRefresh = !opts.fetch

    const rows: OutputRow[] = []

    for (const reg of config.registries) {
      try {
        const registry = await getOrFetchRegistry(cwd, reg, forceRefresh)
        for (const comp of Object.values(registry.components)) {
          const lockEntry = lock.components[comp.name]
          rows.push({
            name: comp.name,
            category: comp.category,
            description: comp.description,
            registry: reg.name,
            version: registry.version,
            installed: !!lockEntry,
            installedVersion: lockEntry?.version,
          })
        }
      } catch (err) {
        if (!opts.json) {
          console.warn(`  Warning: could not fetch ${reg.name}: ${err}`)
        }
      }
    }

    if (spinner) spinner.stop()

    if (opts.json) {
      console.log(JSON.stringify(rows, null, 2))
      return
    }

    if (rows.length === 0) {
      if (isTTY) {
        console.log(chalk.yellow('No components found in connected registries.'))
      }
      return
    }

    if (!isTTY) {
      // Clean output for piped usage
      for (const row of rows) {
        const status = row.installed ? `v${row.installedVersion} installed` : '(not installed)'
        console.log(`${row.name}\t${row.category}\t${row.registry}\t${status}`)
      }
      return
    }

    // TTY formatted table
    const nameWidth = Math.max(10, ...rows.map((r) => r.name.length)) + 2
    const catWidth = Math.max(10, ...rows.map((r) => r.category.length)) + 2
    const regWidth = Math.max(10, ...rows.map((r) => r.registry.length)) + 2

    console.log('')
    console.log(
      chalk.bold(
        '  ' +
          'Component'.padEnd(nameWidth) +
          'Category'.padEnd(catWidth) +
          'Registry'.padEnd(regWidth) +
          'Status'
      )
    )
    console.log('  ' + '─'.repeat(nameWidth + catWidth + regWidth + 20))

    for (const row of rows) {
      const status = row.installed
        ? chalk.green(`v${row.installedVersion} ✓ installed`)
        : chalk.dim('(not installed)')
      console.log(
        '  ' +
          row.name.padEnd(nameWidth) +
          row.category.padEnd(catWidth) +
          row.registry.padEnd(regWidth) +
          status
      )
    }

    console.log('')
    console.log(`Run ${chalk.cyan('blokos add <name>')} to install a component.`)
  })
