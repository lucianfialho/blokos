import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { readLockfile, writeLockfile, hashFile, detectModifiedFiles } from './lockfile.js'
import type { LockEntry, Lockfile } from './lockfile.js'

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'blokos-lockfile-test-'))
}

describe('readLockfile', () => {
  it('returns empty structure when file does not exist', async () => {
    const cwd = makeTmpDir()
    const lock = await readLockfile(cwd)
    expect(lock.version).toBe(1)
    expect(lock.components).toEqual({})
    await fs.remove(cwd)
  })

  it('returns parsed lockfile when file exists', async () => {
    const cwd = makeTmpDir()
    const data: Lockfile = {
      version: 1,
      components: {
        Button: {
          registry: 'my-registry',
          registryUrl: 'https://example.com',
          version: '1.0.0',
          installedAt: '2026-03-28T10:00:00Z',
          files: { 'components/ui/button.tsx': 'sha256:abc123' },
        },
      },
    }
    await fs.writeJson(path.join(cwd, 'blokos.lock'), data, { spaces: 2 })
    const lock = await readLockfile(cwd)
    expect(lock).toEqual(data)
    await fs.remove(cwd)
  })
})

describe('writeLockfile', () => {
  it('creates the file with correct JSON', async () => {
    const cwd = makeTmpDir()
    const lock: Lockfile = {
      version: 1,
      components: {
        Alert: {
          registry: 'test-reg',
          registryUrl: 'https://example.com/reg',
          version: '2.0.0',
          installedAt: '2026-03-28T12:00:00Z',
          files: { 'components/ui/alert.tsx': 'sha256:deadbeef' },
        },
      },
    }
    await writeLockfile(cwd, lock)
    const raw = await fs.readJson(path.join(cwd, 'blokos.lock'))
    expect(raw).toEqual(lock)
    await fs.remove(cwd)
  })
})

describe('hashFile', () => {
  it('returns consistent sha256 for same content', async () => {
    const cwd = makeTmpDir()
    const filePath = path.join(cwd, 'file.txt')
    await fs.writeFile(filePath, 'hello world')
    const h1 = await hashFile(filePath)
    const h2 = await hashFile(filePath)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^sha256:[a-f0-9]{64}$/)
    await fs.remove(cwd)
  })

  it('returns different hashes for different content', async () => {
    const cwd = makeTmpDir()
    const f1 = path.join(cwd, 'a.txt')
    const f2 = path.join(cwd, 'b.txt')
    await fs.writeFile(f1, 'content A')
    await fs.writeFile(f2, 'content B')
    const h1 = await hashFile(f1)
    const h2 = await hashFile(f2)
    expect(h1).not.toBe(h2)
    await fs.remove(cwd)
  })
})

describe('detectModifiedFiles', () => {
  let cwd: string
  let entry: LockEntry

  beforeEach(async () => {
    cwd = makeTmpDir()
    await fs.ensureDir(path.join(cwd, 'components', 'ui'))
    await fs.writeFile(path.join(cwd, 'components', 'ui', 'button.tsx'), 'export const Button = () => null')
    const hash = await hashFile(path.join(cwd, 'components', 'ui', 'button.tsx'))
    entry = {
      registry: 'test',
      registryUrl: 'https://example.com',
      version: '1.0.0',
      installedAt: '2026-03-28T10:00:00Z',
      files: {
        'components/ui/button.tsx': hash,
      },
    }
  })

  afterEach(async () => {
    await fs.remove(cwd)
  })

  it('returns empty array when files are unchanged', async () => {
    const modified = await detectModifiedFiles(cwd, entry)
    expect(modified).toEqual([])
  })

  it('returns file path when file was modified', async () => {
    await fs.writeFile(path.join(cwd, 'components', 'ui', 'button.tsx'), 'export const Button = () => <div>changed</div>')
    const modified = await detectModifiedFiles(cwd, entry)
    expect(modified).toContain('components/ui/button.tsx')
  })

  it('returns file path when file does not exist', async () => {
    await fs.remove(path.join(cwd, 'components', 'ui', 'button.tsx'))
    const modified = await detectModifiedFiles(cwd, entry)
    expect(modified).toContain('components/ui/button.tsx')
  })
})
