import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import prompts from 'prompts'
import fs from 'fs-extra'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { CONSUMER_CONFIG } from '../core/constants.js'
import { fetchRegistry, fetchComponentFile, resolveToken } from '../core/registry-fetcher.js'
import { updateLocalSkill } from '../core/skill-updater.js'
import type { ConsumerConfig, RegistryComponent } from '../core/types.js'

async function loadConsumerConfig(cwd: string): Promise<ConsumerConfig> {
  const configPath = path.join(cwd, CONSUMER_CONFIG)
  if (await fs.pathExists(configPath)) {
    return fs.readJson(configPath)
  }
  throw new Error(`No ${CONSUMER_CONFIG} found. Run \`blokos connect <url>\` first.`)
}

async function saveConsumerConfig(cwd: string, config: ConsumerConfig) {
  await fs.writeJson(path.join(cwd, CONSUMER_CONFIG), config, { spaces: 2 })
}

export const addCommand = new Command('add')
  .description('Install component(s) from a connected registry')
  .argument('[name]', 'Component name to install')
  .option('-a, --all', 'Install all components')
  .option('-f, --force', 'Overwrite existing components')
  .action(async (name?: string, options?: { all?: boolean; force?: boolean }) => {
    const cwd = process.cwd()
    const config = await loadConsumerConfig(cwd)

    if (config.registries.length === 0) {
      console.log(chalk.red('No registries connected. Run `blokos connect <url>` first.'))
      process.exit(1)
    }

    if (!name && !options?.all) {
      console.log(chalk.red('Specify a component name or use --all.'))
      console.log(`Run ${chalk.cyan('blokos list')} to see available components.`)
      process.exit(1)
    }

    const spinner = ora('Fetching registry...').start()

    // Collect all components and themes from all registries
    const allComponents: Array<{
      component: RegistryComponent
      registryName: string
      registryUrl: string
      token?: string
    }> = []

    const themes: Array<{
      theme: { cssFile: string; fonts?: string[]; description?: string }
      registryName: string
      registryUrl: string
      token?: string
    }> = []

    for (const reg of config.registries) {
      try {
        const token = await resolveToken(reg.name)
        const registry = await fetchRegistry(reg.url, token)
        for (const comp of Object.values(registry.components)) {
          allComponents.push({
            component: comp,
            registryName: reg.name,
            registryUrl: reg.url,
            token,
          })
        }
        if (registry.theme) {
          themes.push({
            theme: registry.theme,
            registryName: reg.name,
            registryUrl: reg.url,
            token,
          })
        }
      } catch (err) {
        console.warn(`  Warning: could not fetch ${reg.name}: ${err}`)
      }
    }

    // Determine which to install
    let toInstall = allComponents
    if (name) {
      toInstall = allComponents.filter(
        (c) => c.component.name.toLowerCase() === name.toLowerCase() ||
          c.component.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() === name.toLowerCase()
      )
      if (toInstall.length === 0) {
        spinner.fail(`Component "${name}" not found in any connected registry.`)
        process.exit(1)
      }
    }

    spinner.text = `Installing ${toInstall.length} component(s)...`

    const outputDir = path.join(cwd, config.outputDir)
    await fs.ensureDir(outputDir)

    if (!config.installed) config.installed = {}

    const depsToInstall = new Set<string>()

    for (const item of toInstall) {
      const comp = item.component
      const kebabName = comp.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

      // Check existing
      const targetFile = path.join(outputDir, `${kebabName}.tsx`)
      if (await fs.pathExists(targetFile) && !options?.force) {
        spinner.stop()
        const { overwrite } = await prompts({
          type: 'confirm',
          name: 'overwrite',
          message: `${comp.name} already exists. Overwrite?`,
          initial: false,
        })
        if (!overwrite) {
          spinner.start()
          continue
        }
        spinner.start()
      }

      // Download component files (only .tsx files go to output)
      for (const filePath of comp.files) {
        if (!filePath.endsWith('.tsx')) continue

        try {
          const content = await fetchComponentFile(item.registryUrl, filePath, item.token)
          const fileName = path.basename(filePath)
          await fs.writeFile(path.join(outputDir, fileName), content)
        } catch (err) {
          console.warn(`  Warning: could not fetch ${filePath}: ${err}`)
        }
      }

      // Track dependencies
      for (const dep of comp.dependencies) {
        depsToInstall.add(dep)
      }

      // Track installed
      config.installed[comp.name] = {
        name: comp.name,
        registry: item.registryName,
        files: comp.files.filter((f) => f.endsWith('.tsx')).map((f) => path.basename(f)),
      }
    }

    // Install npm dependencies
    if (depsToInstall.size > 0) {
      spinner.text = 'Installing dependencies...'
      const deps = Array.from(depsToInstall).join(' ')
      try {
        execSync(`npm install ${deps}`, { cwd, stdio: 'pipe' })
      } catch {
        console.warn(chalk.yellow(`  Could not auto-install: ${deps}`))
      }
    }

    // Install theme tokens directly into globals.css
    let themeInstalled = false
    for (const t of themes) {
      const globalsPath = path.join(cwd, 'app', 'globals.css')

      if (!(await fs.pathExists(globalsPath)) || options?.force) {
        spinner.text = 'Installing theme...'
        try {
          const cssContent = await fetchComponentFile(t.registryUrl, t.theme.cssFile, t.token)
          await fs.ensureDir(path.join(cwd, 'app'))
          await fs.writeFile(globalsPath, cssContent)
          themeInstalled = true
        } catch (err) {
          console.warn(`  Warning: could not fetch theme: ${err}`)
        }
      }
    }

    await saveConsumerConfig(cwd, config)

    // Update local skill
    spinner.text = 'Updating AI skill...'
    await updateLocalSkill(cwd, config)

    spinner.succeed(`Installed ${toInstall.length} component(s)!`)

    console.log('')
    console.log(`  Output: ${chalk.green(config.outputDir)}`)
    console.log(`  Skill updated in ${chalk.green('.claude/skills/')}`)
    if (themeInstalled) {
      console.log(`  Theme: ${chalk.green('app/globals.css')} — design tokens installed`)
    }
  })
