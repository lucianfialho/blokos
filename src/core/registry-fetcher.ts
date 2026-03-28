import type { RegistryJson } from './types.js'

/**
 * Resolve an auth token for a registry.
 * Priority: explicit token > BLOKOS_TOKEN_<NAME> env var > undefined
 */
export async function resolveToken(
  registryName: string,
  explicitToken?: string
): Promise<string | undefined> {
  if (explicitToken) return explicitToken
  const envKey = `BLOKOS_TOKEN_${registryName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
  return process.env[envKey]
}

/**
 * Convert a GitHub repo URL to the raw content base URL
 * github.com/owner/repo → raw.githubusercontent.com/owner/repo/main
 */
function toRawGitHubUrl(url: string): string {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/?(.*)/)
  if (!match) return url

  const [, owner, repo, rest] = match
  const branch = rest || 'main'
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`
}

function isGitHubUrl(url: string): boolean {
  return url.includes('github.com/')
}

/**
 * Fetch registry.json from a URL (GitHub or plain HTTP)
 */
export async function fetchRegistry(
  url: string,
  token?: string
): Promise<RegistryJson> {
  let registryUrl = url

  if (isGitHubUrl(url)) {
    const baseUrl = toRawGitHubUrl(url)
    registryUrl = `${baseUrl}/registry.json`
  } else if (!url.endsWith('registry.json')) {
    registryUrl = url.replace(/\/$/, '') + '/registry.json'
  }

  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(registryUrl, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<RegistryJson>
}

/**
 * Fetch a single file from the registry
 */
export async function fetchComponentFile(
  baseUrl: string,
  filePath: string,
  token?: string
): Promise<string> {
  let fileUrl: string

  if (isGitHubUrl(baseUrl)) {
    const rawBase = toRawGitHubUrl(baseUrl)
    fileUrl = `${rawBase}/${filePath}`
  } else {
    fileUrl = `${baseUrl.replace(/\/$/, '')}/${filePath}`
  }

  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(fileUrl, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${response.status}`)
  }

  return response.text()
}

/**
 * Fetch the skill file from the registry
 */
export async function fetchSkill(
  baseUrl: string,
  skillPath: string,
  token?: string
): Promise<string> {
  return fetchComponentFile(baseUrl, skillPath, token)
}
