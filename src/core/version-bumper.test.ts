import { describe, it, expect } from 'vitest'
import { bumpVersion } from './version-bumper.js'

describe('bumpVersion', () => {
  describe('patch', () => {
    it('increments patch digit', () => {
      expect(bumpVersion('1.0.0', 'patch')).toBe('1.0.1')
    })

    it('increments patch beyond 9', () => {
      expect(bumpVersion('1.9.9', 'patch')).toBe('1.9.10')
    })

    it('does not reset minor or major', () => {
      expect(bumpVersion('2.3.4', 'patch')).toBe('2.3.5')
    })
  })

  describe('minor', () => {
    it('increments minor and resets patch', () => {
      expect(bumpVersion('1.0.0', 'minor')).toBe('1.1.0')
    })

    it('resets patch when incrementing minor', () => {
      expect(bumpVersion('1.1.5', 'minor')).toBe('1.2.0')
    })

    it('does not reset major', () => {
      expect(bumpVersion('2.9.9', 'minor')).toBe('2.10.0')
    })
  })

  describe('major', () => {
    it('increments major and resets minor and patch', () => {
      expect(bumpVersion('1.0.0', 'major')).toBe('2.0.0')
    })

    it('resets both minor and patch', () => {
      expect(bumpVersion('1.5.9', 'major')).toBe('2.0.0')
    })

    it('increments from 0.x.x', () => {
      expect(bumpVersion('0.1.0', 'major')).toBe('1.0.0')
    })
  })

  describe('edge cases', () => {
    it('throws on invalid version format', () => {
      expect(() => bumpVersion('not-a-version', 'patch')).toThrow()
    })

    it('handles 0.0.0', () => {
      expect(bumpVersion('0.0.0', 'patch')).toBe('0.0.1')
    })

    it('handles large version numbers', () => {
      expect(bumpVersion('10.20.30', 'patch')).toBe('10.20.31')
    })
  })
})
