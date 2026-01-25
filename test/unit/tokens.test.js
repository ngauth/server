/* global describe, test, expect, beforeEach, afterEach */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { ensurePrivateKey, getPublicKeyJwk, generateToken, verifyToken, generateRandomToken } = require('../../src/tokens')

describe('Token Operations', () => {
  let testDir

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('ensurePrivateKey', () => {
    test('should generate new key if none exists', async () => {
      await ensurePrivateKey(testDir)
      const keyPath = path.join(testDir, 'private-key.pem')
      expect(fs.existsSync(keyPath)).toBe(true)
      const keyContent = fs.readFileSync(keyPath, 'utf8')
      expect(keyContent).toContain('BEGIN PRIVATE KEY')
    })

    test('should load existing key if present', async () => {
      // First call generates key
      await ensurePrivateKey(testDir)
      const keyPath = path.join(testDir, 'private-key.pem')
      const originalKey = fs.readFileSync(keyPath, 'utf8')

      // Second call should load same key
      await ensurePrivateKey(testDir)
      const loadedKey = fs.readFileSync(keyPath, 'utf8')
      expect(loadedKey).toBe(originalKey)
    })

    test('should use NGAUTH_KEY env variable if provided', async () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' }
      })

      const originalEnv = process.env.NGAUTH_KEY
      process.env.NGAUTH_KEY = privateKey

      await ensurePrivateKey(testDir)
      const keyPath = path.join(testDir, 'private-key.pem')

      // Should not create file when using env var
      expect(fs.existsSync(keyPath)).toBe(false)

      if (originalEnv) {
        process.env.NGAUTH_KEY = originalEnv
      } else {
        delete process.env.NGAUTH_KEY
      }
    })
  })

  describe('generateToken', () => {
    beforeEach(async () => {
      await ensurePrivateKey(testDir)
    })

    test('should generate valid JWT token', async () => {
      const payload = { sub: 'user123', client_id: 'client456' }
      const token = generateToken(payload, '1h')

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT format
    })

    test('should include payload in token', async () => {
      const payload = { sub: 'user123', client_id: 'client456', scope: 'read write' }
      const token = generateToken(payload, '1h')
      const decoded = verifyToken(token)

      expect(decoded.sub).toBe('user123')
      expect(decoded.client_id).toBe('client456')
      expect(decoded.scope).toBe('read write')
    })

    test('should set expiration time', async () => {
      const payload = { sub: 'user123' }
      const token = generateToken(payload, '1h')
      const decoded = verifyToken(token)

      expect(decoded.exp).toBeDefined()
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp - decoded.iat).toBe(3600) // 1 hour in seconds
    })
  })

  describe('verifyToken', () => {
    beforeEach(async () => {
      await ensurePrivateKey(testDir)
    })

    test('should verify valid token', async () => {
      const payload = { sub: 'user123' }
      const token = generateToken(payload, '1h')
      const decoded = verifyToken(token)

      expect(decoded.sub).toBe('user123')
    })

    test('should reject invalid token', async () => {
      expect(() => verifyToken('invalid.token.here')).toThrow()
    })

    test('should reject expired token', async () => {
      const payload = { sub: 'user123' }
      const token = generateToken(payload, '1ms')

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(() => verifyToken(token)).toThrow()
    })
  })

  describe('generateRandomToken', () => {
    test('should generate hex string of correct length', async () => {
      const token = generateRandomToken(16)
      expect(token).toHaveLength(32) // 16 bytes = 32 hex chars
      expect(/^[a-f0-9]+$/.test(token)).toBe(true)
    })

    test('should generate different tokens', async () => {
      const token1 = generateRandomToken(32)
      const token2 = generateRandomToken(32)
      expect(token1).not.toBe(token2)
    })

    test('should use default 32 bytes if no size specified', async () => {
      const token = generateRandomToken()
      expect(token).toHaveLength(64) // 32 bytes = 64 hex chars
    })
  })

  describe('getPublicKeyJwk', () => {
    beforeEach(async () => {
      await ensurePrivateKey(testDir)
    })

    test('should return JWK format', async () => {
      const jwk = await getPublicKeyJwk()

      expect(jwk).toHaveProperty('kty')
      expect(jwk).toHaveProperty('n')
      expect(jwk).toHaveProperty('e')
      expect(jwk.use).toBe('sig')
      expect(jwk.alg).toBe('RS256')
    })

    test('should include key ID', async () => {
      const jwk = await getPublicKeyJwk()
      expect(jwk.kid).toBeDefined()
      expect(typeof jwk.kid).toBe('string')
      expect(jwk.kid.length).toBe(16)
    })
  })
})
