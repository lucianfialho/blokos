import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

// Helper: scaffold files in tmpDir based on mode, mimicking what init does.
// We extract the scaffolding logic into a testable function by calling
// the init command's action directly via parseAsync on the sub-command itself.
async function runInit(tmpDir: string, extraArgs: string[] = []): Promise<void> {
  const originalCwd = process.cwd
  process.cwd = () => tmpDir

  try {
    // Import fresh each time (vitest caches modules so we use a workaround)
    const { initCommand } = await import('./init.js')
    // parseAsync on the subcommand itself: argv[0] is fake node, argv[1] is 'init',
    // rest are the actual flags.
    await initCommand.parseAsync(['node', 'init', '--yes', ...extraArgs])
  } finally {
    process.cwd = originalCwd
  }
}

describe('blokos init', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blokos-init-test-'))
  })

  afterEach(async () => {
    await fs.remove(tmpDir)
  })

  it('defaults to tailwind mode when no flag is provided', async () => {
    await runInit(tmpDir)

    const config = await fs.readFile(path.join(tmpDir, 'blokos.config.ts'), 'utf-8')
    expect(config).toContain("mode: 'tailwind'")

    // tailwind mode creates tailwind.config.ts and tokens/colors.ts
    expect(await fs.pathExists(path.join(tmpDir, 'tailwind.config.ts'))).toBe(true)
    expect(await fs.pathExists(path.join(tmpDir, 'tokens', 'colors.ts'))).toBe(true)
  })

  it('sets mode to tailwind+shadcn when --shadcn flag is provided', async () => {
    await runInit(tmpDir, ['--shadcn'])

    const config = await fs.readFile(path.join(tmpDir, 'blokos.config.ts'), 'utf-8')
    expect(config).toContain("mode: 'tailwind+shadcn'")

    // shadcn mode also creates tailwind files
    expect(await fs.pathExists(path.join(tmpDir, 'tailwind.config.ts'))).toBe(true)
    expect(await fs.pathExists(path.join(tmpDir, 'tokens', 'colors.ts'))).toBe(true)
  })

  it('sets mode to css when --vanilla flag is provided', async () => {
    await runInit(tmpDir, ['--vanilla'])

    const config = await fs.readFile(path.join(tmpDir, 'blokos.config.ts'), 'utf-8')
    expect(config).toContain("mode: 'css'")

    // css mode creates tokens/index.ts, not tailwind files
    expect(await fs.pathExists(path.join(tmpDir, 'tokens', 'index.ts'))).toBe(true)
    expect(await fs.pathExists(path.join(tmpDir, 'tailwind.config.ts'))).toBe(false)
  })

  it('generated blokos.config.ts contains the correct mode for each flag', async () => {
    const cases: Array<{ args: string[]; expectedMode: string }> = [
      { args: [], expectedMode: 'tailwind' },
      { args: ['--shadcn'], expectedMode: 'tailwind+shadcn' },
      { args: ['--vanilla'], expectedMode: 'css' },
    ]

    for (const { args, expectedMode } of cases) {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blokos-mode-test-'))
      try {
        await runInit(dir, args)
        const config = await fs.readFile(path.join(dir, 'blokos.config.ts'), 'utf-8')
        expect(config).toContain(`mode: '${expectedMode}'`)
      } finally {
        await fs.remove(dir)
      }
    }
  })
})
