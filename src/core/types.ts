export interface BlokosConfig {
  name: string
  description: string
  framework: 'react'
  baseUrl?: string
  componentsDir?: string
}

export interface ComponentMeta {
  name: string
  description: string
  category: string
  slots: string[]
  dependencies: string[]
  examples: ComponentExample[]
}

export interface ComponentExample {
  description: string
  props: Record<string, unknown>
}

export interface RegistryJson {
  name: string
  version: string
  description: string
  framework: string
  components: Record<string, RegistryComponent>
  theme?: RegistryTheme
  skill?: string
}

export interface RegistryTheme {
  cssFile: string
  fonts?: string[]
  description?: string
}

export interface RegistryComponent {
  name: string
  description: string
  category: string
  files: string[]
  schema: Record<string, unknown>
  dependencies: string[]
  examples: ComponentExample[]
}

export interface ConsumerConfig {
  registries: RegistryEntry[]
  outputDir: string
  installed?: Record<string, InstalledComponent>
}

export interface RegistryEntry {
  name: string
  url: string
  // token removed — stored in .env.local only, never committed to git
}

export interface InstalledComponent {
  name: string
  registry: string
  version?: string
  files: string[]
}
