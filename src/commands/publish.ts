import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'node:path'
import { CONFIG_FILE, REGISTRY_FILE, SKILL_DIR, SKILL_FILE, SKILL_OVERRIDES_FILE, THEME_DIR, THEME_CSS_FILE } from '../core/constants.js'
import { buildRegistry, loadConfig } from '../core/registry-builder.js'
import { generateSkill, loadSkillOverrides } from '../core/skill-generator.js'
import { bumpPackageJson } from '../core/version-bumper.js'
import { diffRegistries } from '../core/registry-diff.js'
import { resolveTokenSource } from '../core/token-reader.js'
import { generateTokenCss } from '../core/css-generator.js'
import type { RegistryJson } from '../core/types.js'

export const publishCommand = new Command('publish')
  .description('Build registry.json and generate AI skill from components')
  .option('--bump <type>', 'Bump version before publishing (patch | minor | major)')
  .action(async (options: { bump?: string }) => {
    const cwd = process.cwd()

    if (!(await fs.pathExists(path.join(cwd, CONFIG_FILE)))) {
      console.log(chalk.red('No blokos registry found. Run `blokos init` first.'))
      process.exit(1)
    }

    // Validate bump type if provided
    if (options.bump && !['patch', 'minor', 'major'].includes(options.bump)) {
      console.log(chalk.red(`Invalid bump type: "${options.bump}". Use patch, minor, or major.`))
      process.exit(1)
    }

    const spinner = ora('Building registry...').start()

    // Bump version in package.json if requested
    if (options.bump) {
      await bumpPackageJson(cwd, options.bump as 'patch' | 'minor' | 'major')
    }

    // Read existing registry for diff computation
    const registryPath = path.join(cwd, REGISTRY_FILE)
    let oldRegistry: RegistryJson | undefined
    if (await fs.pathExists(registryPath)) {
      try {
        oldRegistry = await fs.readJson(registryPath)
      } catch {
        // ignore parse errors — treat as no previous registry
      }
    }

    const registry = await buildRegistry(cwd)
    const componentCount = Object.keys(registry.components).length

    // Compute diff before writing
    const diff = diffRegistries(oldRegistry?.components, registry.components)

    // Write registry.json
    await fs.writeJson(registryPath, registry, { spaces: 2 })
    spinner.text = 'Generating skill...'

    // Generate skill
    const overrides = await loadSkillOverrides(path.join(cwd, SKILL_OVERRIDES_FILE))
    const skill = generateSkill(registry, overrides)

    await fs.ensureDir(path.join(cwd, SKILL_DIR))
    await fs.writeFile(path.join(cwd, SKILL_DIR, SKILL_FILE), skill)

    // Update registry with skill path
    registry.skill = `${SKILL_DIR}/${SKILL_FILE}`
    await fs.writeJson(registryPath, registry, { spaces: 2 })

    // Generate token CSS if token files exist
    const config = await loadConfig(cwd)
    const tokens = await resolveTokenSource(cwd, config.mode)
    let tokenCount = 0
    if (tokens) {
      const css = generateTokenCss(tokens)
      const outputDir = path.join(cwd, THEME_DIR)
      await fs.ensureDir(outputDir)
      await fs.writeFile(path.join(outputDir, THEME_CSS_FILE), css)
      tokenCount = Object.keys(tokens).length
    }

    spinner.succeed(`Published! [v${registry.version}]`)

    console.log('')
    console.log(`  ${chalk.green(REGISTRY_FILE)} — ${componentCount} component(s)`)
    console.log(`  ${chalk.green(`${SKILL_DIR}/${SKILL_FILE}`)} — AI skill`)
    if (tokenCount > 0) {
      console.log(`  ${chalk.green(`${THEME_DIR}/${THEME_CSS_FILE}`)} — ${tokenCount} token(s)`)
    }

    if (diff.length > 0) {
      console.log('')
      console.log('  Changes:')
      for (const entry of diff) {
        if (entry.status === 'new') {
          console.log(`  ${chalk.green('+')} ${entry.name.padEnd(20)} ${chalk.dim('(new)')}`)
        } else if (entry.status === 'modified') {
          console.log(`  ${chalk.yellow('~')} ${entry.name.padEnd(20)} ${chalk.dim('(modified)')}`)
        } else if (entry.status === 'removed') {
          console.log(`  ${chalk.red('-')} ${entry.name.padEnd(20)} ${chalk.dim('(removed)')}`)
        }
      }
    }

    console.log('')
    console.log(`Commit and push to make it available to consumers.`)
  })
