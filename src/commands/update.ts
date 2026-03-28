import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import prompts from 'prompts'
import path from 'node:path'
import fs from 'fs-extra'
import { readLockfile, writeLockfile, hashFile, detectModifiedFiles } from '../core/lockfile.js'
import { fetchRegistry, fetchComponentFile, resolveToken } from '../core/registry-fetcher.js'
import { updateLocalSkill } from '../core/skill-updater.js'
import { CONSUMER_CONFIG } from '../core/constants.js'
import type { ConsumerConfig } from '../core/types.js'

export const updateCommand = new Command('update')
  .description('Update component(s) from the remote registry')
  .argument('[name]', 'Component name to update')
  .option('--all', 'Update all components')
  .option('-f, --force', 'Skip confirmation for locally modified files (CI mode)')
  .action(async (name?: string, options?: { all?: boolean; force?: boolean }) => {
    const cwd = process.cwd()
    const configPath = path.join(cwd, CONSUMER_CONFIG)

    if (!(await fs.pathExists(configPath))) {
      console.log(chalk.red(`No ${CONSUMER_CONFIG} found. Run \`blokos connect <url>\` first.`))
      process.exit(1)
    }

    if (!name && !options?.all) {
      console.log(chalk.red('Specify a component name or use --all.'))
      process.exit(1)
    }

    const config: ConsumerConfig = await fs.readJson(configPath)
    const lock = await readLockfile(cwd)

    const allLocked = Object.keys(lock.components)
    if (allLocked.length === 0) {
      console.log(chalk.yellow('No components tracked in blokos.lock.'))
      return
    }

    // Determine which components to update
    let targets: string[]
    if (options?.all) {
      targets = allLocked
    } else {
      if (!allLocked.includes(name!)) {
        console.log(chalk.red(`Component "${name}" not found in blokos.lock.`))
        process.exit(1)
      }
      targets = [name!]
    }

    const spinner = ora('Fetching registry...').start()

    // Build a remote registry map
    const remoteComponents = new Map<
      string,
      { component: any; registryUrl: string; token?: string }
    >()

    for (const reg of config.registries) {
      try {
        const token = await resolveToken(reg.name)
        const registry = await fetchRegistry(reg.url, token)
        for (const [compName, comp] of Object.entries(registry.components)) {
          remoteComponents.set(compName, { component: comp, registryUrl: reg.url, token })
        }
      } catch {
        // skip unreachable registries
      }
    }

    spinner.stop()

    let updatedCount = 0

    for (const compName of targets) {
      const entry = lock.components[compName]
      const remote = remoteComponents.get(compName)

      if (!remote) {
        console.log(chalk.yellow(`  ${compName}: not found in any registry, skipping.`))
        continue
      }

      // Detect local modifications
      const modified = await detectModifiedFiles(cwd, entry)

      if (modified.length > 0 && !options?.force) {
        console.log(
          chalk.yellow(`\n  ${compName}: the following files were modified locally:`)
        )
        for (const f of modified) {
          console.log(`    ${chalk.cyan(f)}`)
        }
        const { proceed } = await prompts({
          type: 'confirm',
          name: 'proceed',
          message: `Overwrite local changes in ${compName}?`,
          initial: false,
        })
        if (!proceed) {
          console.log(chalk.gray(`  Skipping ${compName}.`))
          continue
        }
      }

      const spinnerUpdate = ora(`Updating ${compName}...`).start()

      const outputDir = path.join(cwd, config.outputDir)
      await fs.ensureDir(outputDir)

      const newFiles: Record<string, string> = {}

      for (const filePath of remote.component.files) {
        if (!filePath.endsWith('.tsx')) continue
        try {
          const content = await fetchComponentFile(remote.registryUrl, filePath, remote.token)
          const fileName = path.basename(filePath)
          const destPath = path.join(outputDir, fileName)
          await fs.writeFile(destPath, content)
          const relPath = path.join(config.outputDir, fileName)
          newFiles[relPath] = await hashFile(destPath)
        } catch (err) {
          console.warn(`  Warning: could not fetch ${filePath}: ${err}`)
        }
      }

      // Update lockfile entry
      lock.components[compName] = {
        ...entry,
        version: remote.component.version ?? entry.version,
        installedAt: new Date().toISOString(),
        files: newFiles,
      }

      updatedCount++
      spinnerUpdate.succeed(`${compName} updated to ${lock.components[compName].version}`)
    }

    await writeLockfile(cwd, lock)

    // Update consumer config installed list
    if (!config.installed) config.installed = {}
    for (const compName of targets) {
      const remote = remoteComponents.get(compName)
      if (!remote) continue
      config.installed[compName] = {
        name: compName,
        registry: lock.components[compName]?.registry ?? '',
        files: remote.component.files
          .filter((f: string) => f.endsWith('.tsx'))
          .map((f: string) => path.basename(f)),
      }
    }
    await fs.writeJson(configPath, config, { spaces: 2 })

    // Update AI skill
    const skillSpinner = ora('Updating AI skill...').start()
    await updateLocalSkill(cwd, config)
    skillSpinner.succeed('AI skill updated')

    console.log(
      updatedCount > 0
        ? chalk.green(`\nUpdated ${updatedCount} component(s).`)
        : chalk.yellow('\nNo components were updated.')
    )
  })
