const { hashPassword, verifyPassword, validatePassword, validateUsername, validateEmail } = require('../../src/users')

describe('User utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testpassword123'
      const hash = await hashPassword(password)
      expect(hash).not.toEqual(password)
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should produce different hashes for same password', async () => {
      const password = 'testpassword123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      expect(hash1).not.toEqual(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testpassword123'
      const hash = await hashPassword(password)
      const result = await verifyPassword(password, hash)
      expect(result).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'testpassword123'
      const hash = await hashPassword(password)
      const result = await verifyPassword('wrongpassword', hash)
      expect(result).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should accept valid password', () => {
      expect(() => validatePassword('ValidPass123!')).not.toThrow()
    })

    it('should reject short password', () => {
      expect(() => validatePassword('Short1!')).toThrow()
    })

    it('should reject empty password', () => {
      expect(() => validatePassword('')).toThrow()
    })

    it('should reject password with insufficient complexity', () => {
      expect(() => validatePassword('lowercase123')).toThrow()
    })
  })

  describe('validateUsername', () => {
    it('should accept valid username', () => {
      expect(() => validateUsername('validuser')).not.toThrow()
    })

    it('should reject short username', () => {
      expect(() => validateUsername('ab')).toThrow()
    })

    it('should accept username with underscores and numbers', () => {
      expect(() => validateUsername('valid_user_123')).not.toThrow()
    })

    it('should reject username with special characters', () => {
      expect(() => validateUsername('invalid-user')).toThrow()
    })
  })

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(() => validateEmail('user@example.com')).not.toThrow()
    })

    it('should reject invalid email', () => {
      expect(() => validateEmail('notanemail')).toThrow()
    })

    it('should reject empty email', () => {
      expect(() => validateEmail('')).toThrow()
    })
  })
})
