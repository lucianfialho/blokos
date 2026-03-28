import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { META_FILE } from '../core/constants.js'

async function runCreate(tmpDir: string, name: string, extraArgs: string[] = []): Promise<void> {
  const originalCwd = process.cwd
  process.cwd = () => tmpDir

  try {
    const { createCommand } = await import('./create.js')
    await createCommand.parseAsync(['node', 'create', name, ...extraArgs])
  } finally {
    process.cwd = originalCwd
  }
}

async function setupRegistry(tmpDir: string, mode: string = 'tailwind'): Promise<void> {
  // Create a minimal blokos.config.ts so the create command finds it
  await fs.writeFile(
    path.join(tmpDir, 'blokos.config.ts'),
    `export default {
  name: 'test-registry',
  description: 'Test',
  framework: 'react',
  mode: '${mode}',
}
`
  )
}

describe('blokos create', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blokos-create-test-'))
  })

  afterEach(async () => {
    await fs.remove(tmpDir)
  })

  it('defaults category to atom when no flag is provided', async () => {
    await setupRegistry(tmpDir)
    await runCreate(tmpDir, 'my-button')

    const meta = await fs.readJson(path.join(tmpDir, 'components', 'my-button', META_FILE))
    expect(meta.category).toBe('atom')
  })

  it('sets category to organism when --organism flag is provided', async () => {
    await setupRegistry(tmpDir)
    await runCreate(tmpDir, 'page-header', ['--organism'])

    const meta = await fs.readJson(path.join(tmpDir, 'components', 'page-header', META_FILE))
    expect(meta.category).toBe('organism')
  })

  it('sets category to molecule when --molecule flag is provided', async () => {
    await setupRegistry(tmpDir)
    await runCreate(tmpDir, 'card-group', ['--molecule'])

    const meta = await fs.readJson(path.join(tmpDir, 'components', 'card-group', META_FILE))
    expect(meta.category).toBe('molecule')
  })

  it('sets category to template when --template flag is provided', async () => {
    await setupRegistry(tmpDir)
    await runCreate(tmpDir, 'landing-page', ['--template'])

    const meta = await fs.readJson(path.join(tmpDir, 'components', 'landing-page', META_FILE))
    expect(meta.category).toBe('template')
  })

  it('template contains Tailwind classes when mode is tailwind', async () => {
    await setupRegistry(tmpDir, 'tailwind')
    await runCreate(tmpDir, 'hero-button')

    const component = await fs.readFile(
      path.join(tmpDir, 'components', 'hero-button', 'hero-button.tsx'),
      'utf-8'
    )
    expect(component).toContain('bg-brand-500')
    expect(component).toContain('tailwind.config.ts')
  })

  it('template contains shadcn CSS vars when mode is tailwind+shadcn', async () => {
    await setupRegistry(tmpDir, 'tailwind+shadcn')
    await runCreate(tmpDir, 'action-button')

    const component = await fs.readFile(
      path.join(tmpDir, 'components', 'action-button', 'action-button.tsx'),
      'utf-8'
    )
    expect(component).toContain('bg-primary')
    expect(component).toContain('text-primary-foreground')
  })

  it('template contains CSS vars when mode is css', async () => {
    await setupRegistry(tmpDir, 'css')
    await runCreate(tmpDir, 'plain-button')

    const component = await fs.readFile(
      path.join(tmpDir, 'components', 'plain-button', 'plain-button.tsx'),
      'utf-8'
    )
    expect(component).toContain('var(--color-primary)')
    expect(component).toContain('tokens/index.ts')
  })
})
