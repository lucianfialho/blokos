import type { RegistryComponent } from './types.js'

/**
 * Returns components matching the query — partial, case-insensitive match
 * on name, description, or category.
 */
export function searchComponents(
  components: Record<string, RegistryComponent>,
  query: string
): RegistryComponent[] {
  const q = query.toLowerCase()
  return Object.values(components).filter((comp) => {
    return (
      comp.name.toLowerCase().includes(q) ||
      comp.description.toLowerCase().includes(q) ||
      comp.category.toLowerCase().includes(q)
    )
  })
}

/**
 * Tokenizes phrase and searches each token (OR logic).
 * Deduplicates results by component name.
 */
export function suggestComponents(
  components: Record<string, RegistryComponent>,
  phrase: string
): RegistryComponent[] {
  const tokens = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0)

  if (tokens.length === 0) return []

  const seen = new Set<string>()
  const results: RegistryComponent[] = []

  for (const token of tokens) {
    for (const comp of searchComponents(components, token)) {
      if (!seen.has(comp.name)) {
        seen.add(comp.name)
        results.push(comp)
      }
    }
  }

  return results
}
