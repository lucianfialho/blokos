import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import prompts from 'prompts'
import fs from 'fs-extra'
import path from 'node:path'
import { CONSUMER_CONFIG } from '../core/constants.js'
import { fetchRegistry, resolveToken } from '../core/registry-fetcher.js'
import type { ConsumerConfig } from '../core/types.js'

async function loadConsumerConfig(cwd: string): Promise<ConsumerConfig> {
  const configPath = path.join(cwd, CONSUMER_CONFIG)
  if (await fs.pathExists(configPath)) {
    return fs.readJson(configPath)
  }
  return { registries: [], outputDir: 'components/ui', installed: {} }
}

async function saveConsumerConfig(cwd: string, config: ConsumerConfig) {
  await fs.writeJson(path.join(cwd, CONSUMER_CONFIG), config, { spaces: 2 })
}

export const connectCommand = new Command('connect')
  .description('Connect to a component registry')
  .argument('[url]', 'Registry URL (GitHub repo or HTTP)')
  .option('-t, --token <token>', 'Auth token for private registries')
  .option('-o, --output <dir>', 'Output directory for components', 'components/ui')
  .action(async (url?: string, options?: { token?: string; output?: string }) => {
    const cwd = process.cwd()
    const config = await loadConsumerConfig(cwd)

    // List mode
    if (!url) {
      if (config.registries.length === 0) {
        console.log(chalk.yellow('No registries connected.'))
        console.log(`Run ${chalk.cyan('blokos connect <url>')} to connect one.`)
        return
      }

      console.log(chalk.bold('Connected registries:'))
      console.log('')
      for (const reg of config.registries) {
        const token = await resolveToken(reg.name)
        const authLabel = token ? chalk.green(' (authenticated)') : ''
        console.log(`  ${chalk.cyan(reg.name)} — ${reg.url}${authLabel}`)
      }
      return
    }

    const spinner = ora('Connecting to registry...').start()

    let token = options?.token

    // Try fetching
    try {
      let registry = await fetchRegistry(url, token).catch(async (err) => {
        if (err.message.includes('401') || err.message.includes('403')) {
          spinner.stop()
          if (!token) {
            const answer = await prompts({
              type: 'password',
              name: 'token',
              message: 'Registry requires authentication. Enter token:',
            })
            token = answer.token
            spinner.start('Retrying with token...')
            return fetchRegistry(url, token)
          }
        }
        throw err
      })

      if (!registry) {
        spinner.fail('Could not connect to registry.')
        return
      }

      // Check if already connected
      const existing = config.registries.findIndex((r) => r.url === url)
      const entry = { name: registry.name, url }

      if (existing >= 0) {
        config.registries[existing] = entry
      } else {
        config.registries.push(entry)
      }

      if (options?.output) {
        config.outputDir = options.output
      }

      await saveConsumerConfig(cwd, config)

      // Store token in .env.local if provided (never in blokos.json)
      if (token) {
        const envPath = path.join(cwd, '.env.local')
        const envKey = `BLOKOS_TOKEN_${registry.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
        let envContent = ''
        if (await fs.pathExists(envPath)) {
          envContent = await fs.readFile(envPath, 'utf-8')
        }
        if (!envContent.includes(envKey)) {
          envContent += `\n${envKey}=${token}\n`
          await fs.writeFile(envPath, envContent)
        }

        // Ensure .env.local is in .gitignore
        const gitignorePath = path.join(cwd, '.gitignore')
        if (await fs.pathExists(gitignorePath)) {
          const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8')
          if (!gitignoreContent.includes('.env.local')) {
            await fs.appendFile(gitignorePath, '\n.env.local\n')
          }
        }

        console.log(chalk.green('  Token saved to .env.local (not committed)'))
      }

      spinner.succeed(`Connected to ${chalk.cyan(registry.name)}!`)

      const componentCount = Object.keys(registry.components).length
      console.log('')
      console.log(`  ${componentCount} component(s) available`)
      console.log(`  Output: ${chalk.green(config.outputDir)}`)
      console.log('')
      console.log(`Next: ${chalk.cyan('blokos list')} or ${chalk.cyan('blokos add <component>')}`)
    } catch (err) {
      spinner.fail(`Failed to connect: ${err instanceof Error ? err.message : err}`)
      process.exit(1)
    }
  })
