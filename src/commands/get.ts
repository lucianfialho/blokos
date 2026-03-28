import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'node:path'
import { CONSUMER_CONFIG } from '../core/constants.js'
import { getOrFetchRegistry } from '../core/registry-cache.js'
import { readLockfile } from '../core/lockfile.js'
import type { ConsumerConfig, RegistryComponent } from '../core/types.js'

interface ComponentDetail {
  name: string
  category: string
  description: string
  version: string
  files: string[]
  dependencies: string[]
  examples: Array<{ description: string; props: Record<string, unknown> }>
  schema: Record<string, unknown>
  installed: boolean
  installedVersion: string | undefined
  registry: string
}

function printDetail(detail: ComponentDetail): void {
  const isTTY = process.stdout.isTTY

  if (!isTTY) {
    console.log(`${detail.name}\t${detail.category}\t${detail.description}`)
    console.log(`version: ${detail.version}`)
    console.log(`installed: ${detail.installed ? detail.installedVersion : 'no'}`)
    console.log(`dependencies: ${detail.dependencies.join(', ') || 'none'}`)
    console.log(`files: ${detail.files.join(', ')}`)
    return
  }

  console.log('')
  console.log(chalk.bold.cyan(detail.name) + chalk.dim(` (${detail.category})`))
  console.log(detail.description)
  console.log('')

  const installStatus = detail.installed
    ? chalk.green(`✓ installed  v${detail.installedVersion}`) +
      (detail.installedVersion !== detail.version
        ? chalk.yellow(`  (latest: v${detail.version})`)
        : '')
    : chalk.dim('(not installed)')

  console.log(chalk.bold('Status:     ') + installStatus)
  console.log(chalk.bold('Registry:   ') + detail.registry)
  console.log(chalk.bold('Version:    ') + `v${detail.version}`)
  console.log('')

  if (detail.dependencies.length > 0) {
    console.log(chalk.bold('Dependencies:'))
    for (const dep of detail.dependencies) {
      console.log(`  • ${dep}`)
    }
    console.log('')
  }

  if (detail.files.length > 0) {
    console.log(chalk.bold('Files:'))
    for (const file of detail.files) {
      console.log(`  • ${file}`)
    }
    console.log('')
  }

  // Props schema
  const props = detail.schema?.properties as Record<string, { type?: string; description?: string }> | undefined
  if (props && Object.keys(props).length > 0) {
    console.log(chalk.bold('Props:'))
    const propNameWidth = Math.max(10, ...Object.keys(props).map((k) => k.length)) + 2
    const propTypeWidth = 12

    console.log(
      '  ' +
        chalk.bold('Name'.padEnd(propNameWidth)) +
        chalk.bold('Type'.padEnd(propTypeWidth)) +
        chalk.bold('Description')
    )
    console.log('  ' + '─'.repeat(propNameWidth + propTypeWidth + 30))

    for (const [propName, propDef] of Object.entries(props)) {
      const propType = String(propDef?.type ?? 'unknown')
      const propDesc = propDef?.description ?? ''
      console.log(
        '  ' +
          propName.padEnd(propNameWidth) +
          propType.padEnd(propTypeWidth) +
          chalk.dim(propDesc)
      )
    }
    console.log('')
  }

  if (detail.examples.length > 0) {
    console.log(chalk.bold('Examples:'))
    for (const ex of detail.examples) {
      console.log(`  ${chalk.dim('—')} ${ex.description}`)
      console.log('    ' + chalk.dim(JSON.stringify(ex.props)))
    }
    console.log('')
  }

  console.log(`Run ${chalk.cyan(`blokos add ${detail.name}`)} to install.`)
  console.log('')
}

export const getCommand = new Command('get')
  .description('Get full details of a component')
  .argument('<name>', 'Component name')
  .option('--json', 'Output as JSON')
  .option('--no-fetch', 'Skip remote refresh, use cached registry only')
  .action(async (name: string, opts: { json?: boolean; fetch: boolean }) => {
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

    let found: ComponentDetail | null = null

    for (const reg of config.registries) {
      try {
        const registry = await getOrFetchRegistry(cwd, reg, forceRefresh)
        // Case-insensitive lookup
        const comp: RegistryComponent | undefined =
          registry.components[name] ??
          Object.values(registry.components).find(
            (c) => c.name.toLowerCase() === name.toLowerCase()
          )

        if (comp) {
          const lockEntry = lock.components[comp.name]
          found = {
            name: comp.name,
            category: comp.category,
            description: comp.description,
            version: registry.version,
            files: comp.files,
            dependencies: comp.dependencies,
            examples: comp.examples,
            schema: comp.schema,
            installed: !!lockEntry,
            installedVersion: lockEntry?.version,
            registry: reg.name,
          }
          break
        }
      } catch (err) {
        if (!opts.json) {
          console.warn(chalk.yellow(`  Warning: could not fetch ${reg.name}: ${err}`))
        }
      }
    }

    if (!found) {
      if (opts.json) {
        console.log(JSON.stringify({ error: `Component "${name}" not found.` }))
      } else {
        console.error(chalk.red(`Component "${name}" not found in any connected registry.`))
      }
      process.exit(1)
    }

    if (opts.json) {
      console.log(JSON.stringify(found, null, 2))
      return
    }

    printDetail(found)
  })
