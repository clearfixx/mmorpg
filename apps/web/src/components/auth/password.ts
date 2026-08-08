export type PasswordStrength = 'weak' | 'medium' | 'strong'

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*_-+=?'

export function passwordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (score >= 5) return 'strong'
  if (score >= 3) return 'medium'
  return 'weak'
}

export function generateStrongPassword(length = 20): string {
  const size = Math.max(16, Math.floor(length))
  const all = LOWER + UPPER + DIGITS + SYMBOLS
  const characters = [
    randomCharacter(LOWER),
    randomCharacter(UPPER),
    randomCharacter(DIGITS),
    randomCharacter(SYMBOLS),
  ]
  while (characters.length < size) characters.push(randomCharacter(all))
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = secureIndex(index + 1)
    ;[characters[index], characters[swap]] = [
      characters[swap]!,
      characters[index]!,
    ]
  }
  return characters.join('')
}

function randomCharacter(alphabet: string): string {
  return alphabet[secureIndex(alphabet.length)]!
}

function secureIndex(limit: number): number {
  const range = 2 ** 32
  const ceiling = range - (range % limit)
  const value = new Uint32Array(1)
  do globalThis.crypto.getRandomValues(value)
  while (value[0]! >= ceiling)
  return value[0]! % limit
}
