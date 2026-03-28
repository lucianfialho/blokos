import { Command } from 'commander'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'node:path'
import { CONFIG_FILE, THEME_DIR, THEME_CSS_FILE } from '../core/constants.js'
import { loadConfig } from '../core/registry-builder.js'
import { resolveTokenSource } from '../core/token-reader.js'
import { generateTokenCss } from '../core/css-generator.js'

export const tokenCommand = new Command('token')
  .description('Token management commands')

tokenCommand
  .command('sync')
  .description('Generate theme/tokens.css from token files')
  .action(async () => {
    const cwd = process.cwd()

    if (!(await fs.pathExists(path.join(cwd, CONFIG_FILE)))) {
      console.log(chalk.red('No blokos registry found. Run `blokos init` first.'))
      process.exit(1)
    }

    const config = await loadConfig(cwd)
    const tokens = await resolveTokenSource(cwd, config.mode)

    if (!tokens) {
      console.log(chalk.yellow('No token files found. Create tokens/colors.ts or tokens/index.ts first.'))
      process.exit(0)
    }

    const css = generateTokenCss(tokens)
    const outputDir = path.join(cwd, THEME_DIR)
    const outputPath = path.join(outputDir, THEME_CSS_FILE)

    await fs.ensureDir(outputDir)
    await fs.writeFile(outputPath, css)

    const tokenCount = Object.keys(tokens).length
    console.log(`  ${chalk.green(`${THEME_DIR}/${THEME_CSS_FILE}`)} — ${tokenCount} token${tokenCount !== 1 ? 's' : ''}`)
  })
