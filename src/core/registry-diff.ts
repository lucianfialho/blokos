import type { RegistryComponent } from './types.js'

export type DiffEntry = {
  name: string
  status: 'new' | 'modified' | 'removed'
}

function isModified(prev: RegistryComponent, next: RegistryComponent): boolean {
  if (prev.description !== next.description) return true
  if (JSON.stringify(prev.dependencies) !== JSON.stringify(next.dependencies)) return true
  if (JSON.stringify(prev.examples) !== JSON.stringify(next.examples)) return true
  return false
}

export function diffRegistries(
  oldComponents: Record<string, RegistryComponent> | undefined,
  newComponents: Record<string, RegistryComponent>,
): DiffEntry[] {
  const entries: DiffEntry[] = []

  if (!oldComponents) {
    // No previous registry — all are new
    for (const name of Object.keys(newComponents)) {
      entries.push({ name, status: 'new' })
    }
    return entries
  }

  const oldKeys = new Set(Object.keys(oldComponents))
  const newKeys = new Set(Object.keys(newComponents))

  for (const name of newKeys) {
    if (!oldKeys.has(name)) {
      entries.push({ name, status: 'new' })
    } else if (isModified(oldComponents[name], newComponents[name])) {
      entries.push({ name, status: 'modified' })
    }
  }

  for (const name of oldKeys) {
    if (!newKeys.has(name)) {
      entries.push({ name, status: 'removed' })
    }
  }

  return entries
}
