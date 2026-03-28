import path from 'node:path'
import fs from 'fs-extra'

export function bumpVersion(current: string, type: 'patch' | 'minor' | 'major'): string {
  const parts = current.split('.').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${current}`)
  }
  let [major, minor, patch] = parts

  if (type === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (type === 'minor') {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }

  return `${major}.${minor}.${patch}`
}

export async function bumpPackageJson(cwd: string, type: 'patch' | 'minor' | 'major'): Promise<string> {
  const pkgPath = path.join(cwd, 'package.json')
  const pkg = await fs.readJson(pkgPath)
  const newVersion = bumpVersion(pkg.version || '1.0.0', type)
  pkg.version = newVersion
  await fs.writeJson(pkgPath, pkg, { spaces: 2 })
  return newVersion
}
