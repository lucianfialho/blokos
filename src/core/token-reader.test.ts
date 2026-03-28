import { describe, it, expect } from 'vitest'
import { flattenTokens } from './token-reader.js'

describe('flattenTokens', () => {
  it('flattens single-level object correctly', () => {
    const input = { primary: '#0ea5e9', secondary: '#8b5cf6' }
    const result = flattenTokens(input)
    expect(result).toEqual({
      '--color-primary': '#0ea5e9',
      '--color-secondary': '#8b5cf6',
    })
  })

  it('flattens two-level nested object', () => {
    const input = {
      brand: { 50: '#f0f9ff', 500: '#0ea5e9', 900: '#0c4a6e' },
    }
    const result = flattenTokens(input)
    expect(result).toEqual({
      '--color-brand-50': '#f0f9ff',
      '--color-brand-500': '#0ea5e9',
      '--color-brand-900': '#0c4a6e',
    })
  })

  it('uses custom prefix', () => {
    const input = { spacing: { sm: '0.5rem', md: '1rem' } }
    const result = flattenTokens(input, '--spacing')
    expect(result).toEqual({
      '--spacing-spacing-sm': '0.5rem',
      '--spacing-spacing-md': '1rem',
    })
  })

  it('CSS var names are kebab-case', () => {
    const input = { brandColor: '#ff0000', myPrimary: '#00ff00' }
    const result = flattenTokens(input)
    expect(result).toHaveProperty('--color-brand-color')
    expect(result).toHaveProperty('--color-my-primary')
  })

  it('flattens deeply nested objects', () => {
    const input = {
      semantic: { primary: 'var(--color-brand-500)', background: 'var(--color-brand-50)' },
    }
    const result = flattenTokens(input)
    expect(result).toEqual({
      '--color-semantic-primary': 'var(--color-brand-500)',
      '--color-semantic-background': 'var(--color-brand-50)',
    })
  })
})
