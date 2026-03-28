import path from 'node:path'
import fs from 'fs-extra'
import type { BlokosConfig, ComponentMeta, RegistryJson, RegistryComponent, RegistryTheme } from './types.js'
import { COMPONENTS_DIR, META_FILE, SCHEMA_FILE, CONFIG_FILE, THEME_DIR, THEME_CSS_FILE } from './constants.js'
import { parseZodSchema } from './schema-parser.js'

export async function loadConfig(cwd: string): Promise<BlokosConfig> {
  const configPath = path.join(cwd, CONFIG_FILE)
  const source = await fs.readFile(configPath, 'utf-8')

  // Extract config values from the TS source
  const nameMatch = source.match(/name:\s*['"]([^'"]+)['"]/)
  const descMatch = source.match(/description:\s*['"]([^'"]+)['"]/)
  const frameworkMatch = source.match(/framework:\s*['"]([^'"]+)['"]/)

  return {
    name: nameMatch?.[1] || path.basename(cwd),
    description: descMatch?.[1] || '',
    framework: (frameworkMatch?.[1] as 'react') || 'react',
  }
}

export async function buildRegistry(cwd: string): Promise<RegistryJson> {
  const config = await loadConfig(cwd)
  const componentsDir = path.join(cwd, config.componentsDir || COMPONENTS_DIR)

  // Read version from package.json
  const pkgPath = path.join(cwd, 'package.json')
  let version = '1.0.0'
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath)
    version = pkg.version || '1.0.0'
  }

  const components: Record<string, RegistryComponent> = {}

  if (!(await fs.pathExists(componentsDir))) {
    return {
      name: config.name,
      version,
      description: config.description,
      framework: config.framework,
      components,
    }
  }

  const entries = await fs.readdir(componentsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const componentDir = path.join(componentsDir, entry.name)
    const metaPath = path.join(componentDir, META_FILE)
    const schemaPath = path.join(componentDir, SCHEMA_FILE)

    if (!(await fs.pathExists(metaPath))) {
      console.warn(`  Skipping ${entry.name}: no ${META_FILE}`)
      continue
    }

    const meta: ComponentMeta = await fs.readJson(metaPath)

    let schema: Record<string, unknown> = {}
    if (await fs.pathExists(schemaPath)) {
      try {
        schema = await parseZodSchema(schemaPath)
      } catch (err) {
        console.warn(`  Warning: could not parse schema for ${entry.name}: ${err}`)
      }
    }

    // Collect all files in the component directory
    const files = (await fs.readdir(componentDir))
      .filter((f) => !f.startsWith('.'))
      .map((f) => `${COMPONENTS_DIR}/${entry.name}/${f}`)

    components[meta.name] = {
      name: meta.name,
      description: meta.description,
      category: meta.category,
      files,
      schema,
      dependencies: meta.dependencies,
      examples: meta.examples,
    }
  }

  // Check for theme
  let theme: RegistryTheme | undefined
  const themeCssPath = path.join(cwd, THEME_DIR, THEME_CSS_FILE)
  if (await fs.pathExists(themeCssPath)) {
    const themeMetaPath = path.join(cwd, THEME_DIR, 'meta.json')
    let themeMeta: { fonts?: string[]; description?: string } = {}
    if (await fs.pathExists(themeMetaPath)) {
      themeMeta = await fs.readJson(themeMetaPath)
    }
    theme = {
      cssFile: `${THEME_DIR}/${THEME_CSS_FILE}`,
      fonts: themeMeta.fonts,
      description: themeMeta.description,
    }
  }

  return {
    name: config.name,
    version,
    description: config.description,
    framework: config.framework,
    components,
    ...(theme && { theme }),
  }
}
