import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { createCommand } from './commands/create.js'
import { publishCommand } from './commands/publish.js'
import { connectCommand } from './commands/connect.js'
import { addCommand } from './commands/add.js'
import { listCommand } from './commands/list.js'
import { outdatedCommand } from './commands/outdated.js'
import { updateCommand } from './commands/update.js'
import { tokenCommand } from './commands/token-sync.js'

const program = new Command()

program
  .name('blokos')
  .description('Design System as Catalog — component registries with AI skills built-in')
  .version('0.1.0')

program.addCommand(initCommand)
program.addCommand(createCommand)
program.addCommand(publishCommand)
program.addCommand(connectCommand)
program.addCommand(addCommand)
program.addCommand(listCommand)
program.addCommand(outdatedCommand)
program.addCommand(updateCommand)
program.addCommand(tokenCommand)

program.parse()
