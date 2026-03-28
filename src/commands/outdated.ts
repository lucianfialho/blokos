import { Command } from 'commander'
import chalk from 'chalk'
import path from 'node:path'
import fs from 'fs-extra'
import { readLockfile } from '../core/lockfile.js'
import { fetchRegistry, resolveToken } from '../core/registry-fetcher.js'
import { CONSUMER_CONFIG } from '../core/constants.js'
import type { ConsumerConfig } from '../core/types.js'

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export const outdatedCommand = new Command('outdated')
  .description('Check for outdated components compared to the remote registry')
  .action(async () => {
    const cwd = process.cwd()
    const configPath = path.join(cwd, CONSUMER_CONFIG)

    if (!(await fs.pathExists(configPath))) {
      console.log(chalk.red(`No ${CONSUMER_CONFIG} found. Run \`blokos connect <url>\` first.`))
      process.exit(1)
    }

    const config: ConsumerConfig = await fs.readJson(configPath)
    const lock = await readLockfile(cwd)

    const componentNames = Object.keys(lock.components)
    if (componentNames.length === 0) {
      console.log(chalk.yellow('No components tracked in blokos.lock.'))
      return
    }

    // Build a map of remote versions per registry
    const remoteVersions = new Map<string, Record<string, string>>()

    for (const reg of config.registries) {
      try {
        const token = await resolveToken(reg.name)
        const registry = await fetchRegistry(reg.url, token)
        const versions: Record<string, string> = {}
        for (const [name, comp] of Object.entries(registry.components)) {
          versions[name] = (comp as any).version ?? '0.0.0'
        }
        remoteVersions.set(reg.name, versions)
      } catch {
        // silently skip unreachable registries
      }
    }

    let anyOutdated = false

    for (const [name, entry] of Object.entries(lock.components)) {
      const remoteMap = remoteVersions.get(entry.registry)
      const remoteVersion = remoteMap?.[name]

      if (!remoteVersion) {
        console.log(
          `  ${chalk.bold(name.padEnd(24))} ${chalk.gray('(registry not reachable or component not found)')}`
        )
        continue
      }

      if (compareVersions(remoteVersion, entry.version) > 0) {
        anyOutdated = true
        console.log(
          `  ${chalk.bold(name.padEnd(24))} ${chalk.yellow(entry.version)} ${chalk.gray('→')} ${chalk.green(remoteVersion)}   ${chalk.gray(`(${entry.registry})`)}`
        )
      } else {
        console.log(
          `  ${chalk.bold(name.padEnd(24))} ${chalk.green('up to date')}   ${chalk.gray(`${entry.version} (${entry.registry})`)}`
        )
      }
    }

    if (!anyOutdated) {
      console.log(chalk.green('\nAll components are up to date.'))
    }
  })
