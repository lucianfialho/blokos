import fs from 'fs-extra'
import path from 'node:path'
import type { ConsumerConfig } from './types.js'
import { readLockfile } from './lockfile.js'
import { generateConsumerSkill } from './skill-generator.js'

/**
 * Update the local consumer-side skill at .claude/skills/blokos-skill.md
 */
export async function updateLocalSkill(
  cwd: string,
  config: ConsumerConfig
): Promise<void> {
  const skillsDir = path.join(cwd, '.claude', 'skills')
  await fs.ensureDir(skillsDir)

  // Use the first registry name/description as the primary identity, or a generic fallback
  const primaryRegistry = config.registries[0]
  const registryName = primaryRegistry?.name ?? 'Design System'
  const description = `Connected to ${config.registries.map((r) => r.name).join(', ')}.`

  // Read installed components from lockfile for version info
  const lock = await readLockfile(cwd)
  const installed = config.installed ?? {}

  // Enrich installed components with version from lockfile
  const installedWithVersion: typeof installed = {}
  for (const [name, comp] of Object.entries(installed)) {
    installedWithVersion[name] = {
      ...comp,
      version: lock.components[name]?.version ?? comp.version,
    }
  }

  const skillContent = generateConsumerSkill(
    config.registries,
    installedWithVersion,
    registryName,
    description
  )

  const skillFilePath = path.join(skillsDir, 'blokos-skill.md')
  await fs.writeFile(skillFilePath, skillContent)
}
