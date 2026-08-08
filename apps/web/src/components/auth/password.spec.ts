import { describe, expect, it } from 'vitest'

import { generateStrongPassword, passwordStrength } from './password'

describe('password helpers', () => {
  it('classifies password strength without sending the password anywhere', () => {
    expect(passwordStrength('short')).toBe('weak')
    expect(passwordStrength('longerpassword12')).toBe('medium')
    expect(passwordStrength('LongerPassword12!')).toBe('strong')
  })

  it('generates a password with every required character class', () => {
    const password = generateStrongPassword()
    expect(password).toHaveLength(20)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/\d/)
    expect(password).toMatch(/[^A-Za-z0-9]/)
    expect(passwordStrength(password)).toBe('strong')
  })
})
