import fs from 'fs-extra'
import path from 'node:path'
import crypto from 'node:crypto'

export interface LockEntry {
  registry: string
  registryUrl: string
  version: string
  installedAt: string
  files: Record<string, string>
}

export interface Lockfile {
  version: 1
  components: Record<string, LockEntry>
}

const LOCKFILE_NAME = 'blokos.lock'

const EMPTY_LOCKFILE: Lockfile = {
  version: 1,
  components: {},
}

export async function readLockfile(cwd: string): Promise<Lockfile> {
  const lockPath = path.join(cwd, LOCKFILE_NAME)
  if (!(await fs.pathExists(lockPath))) {
    return { ...EMPTY_LOCKFILE, components: {} }
  }
  return fs.readJson(lockPath) as Promise<Lockfile>
}

export async function writeLockfile(cwd: string, lock: Lockfile): Promise<void> {
  const lockPath = path.join(cwd, LOCKFILE_NAME)
  await fs.writeJson(lockPath, lock, { spaces: 2 })
}

export async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath)
  const hash = crypto.createHash('sha256').update(content).digest('hex')
  return `sha256:${hash}`
}

export async function detectModifiedFiles(
  cwd: string,
  entry: LockEntry
): Promise<string[]> {
  const modified: string[] = []
  for (const [relPath, expectedHash] of Object.entries(entry.files)) {
    const absPath = path.join(cwd, relPath)
    if (!(await fs.pathExists(absPath))) {
      modified.push(relPath)
      continue
    }
    const currentHash = await hashFile(absPath)
    if (currentHash !== expectedHash) {
      modified.push(relPath)
    }
  }
  return modified
}
