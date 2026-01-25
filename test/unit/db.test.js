/* global describe, test, expect, beforeEach, afterEach */
const fs = require('fs')
const path = require('path')
const os = require('os')
const {
  initDb,
  getClients,
  getClient,
  addClient,
  getUsers,
  getUser,
  getCodes,
  addCode,
  getCode,
  deleteCode,
  cleanupExpiredCodes
} = require('../../src/db')

describe('Database Operations', () => {
  let testDir

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-test-'))
    await initDb(testDir)
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('initDb', () => {
    test('should create clients.json file', () => {
      const clientsFile = path.join(testDir, 'clients.json')
      expect(fs.existsSync(clientsFile)).toBe(true)
    })

    test('should create users.json with default user', async () => {
      const usersFile = path.join(testDir, 'users.json')
      expect(fs.existsSync(usersFile)).toBe(true)

      const users = await getUsers()
      expect(users).toHaveLength(1)
      expect(users[0].username).toBe('testuser')
      expect(users[0].password).toBe('testpass')
    })

    test('should create codes.json file', () => {
      const codesFile = path.join(testDir, 'codes.json')
      expect(fs.existsSync(codesFile)).toBe(true)
    })

    test('should not overwrite existing files', async () => {
      const client = { client_id: 'test', client_secret: 'secret' }
      await addClient(client)

      // Re-init should not overwrite
      await initDb(testDir)

      const clients = await getClients()
      expect(clients).toHaveLength(1)
      expect(clients[0].client_id).toBe('test')
    })
  })

  describe('Client Management', () => {
    test('getClients should return empty array initially', async () => {
      const clients = await getClients()
      expect(Array.isArray(clients)).toBe(true)
      expect(clients).toHaveLength(0)
    })

    test('addClient should store client', async () => {
      const client = {
        client_id: 'client123',
        client_secret: 'secret456',
        redirect_uris: ['http://localhost/callback']
      }

      await addClient(client)
      const clients = await getClients()

      expect(clients).toHaveLength(1)
      expect(clients[0].client_id).toBe('client123')
    })

    test('getClient should retrieve by client_id', async () => {
      await addClient({ client_id: 'client1', name: 'First' })
      await addClient({ client_id: 'client2', name: 'Second' })

      const client = await getClient('client1')

      expect(client).toBeDefined()
      expect(client.name).toBe('First')
    })

    test('getClient should return undefined for unknown client_id', async () => {
      const client = await getClient('nonexistent')
      expect(client).toBeUndefined()
    })

    test('should support multiple clients', async () => {
      await addClient({ client_id: 'client1' })
      await addClient({ client_id: 'client2' })
      await addClient({ client_id: 'client3' })

      const clients = await getClients()
      expect(clients).toHaveLength(3)
    })
  })

  describe('User Management', () => {
    test('getUsers should return default test user', async () => {
      const users = await getUsers()
      expect(users).toHaveLength(1)
      expect(users[0].username).toBe('testuser')
    })

    test('getUser should retrieve by username', async () => {
      const user = await getUser('testuser')

      expect(user).toBeDefined()
      expect(user.id).toBe('user1')
      expect(user.password).toBe('testpass')
    })

    test('getUser should return undefined for unknown username', async () => {
      const user = await getUser('unknown')
      expect(user).toBeUndefined()
    })
  })

  describe('Authorization Code Management', () => {
    test('getCodes should return empty array initially', async () => {
      const codes = await getCodes()
      expect(Array.isArray(codes)).toBe(true)
      expect(codes).toHaveLength(0)
    })

    test('addCode should store code', async () => {
      const code = {
        code: 'abc123',
        client_id: 'client1',
        redirect_uri: 'http://localhost/callback',
        scope: 'read',
        userId: 'user1',
        expiresAt: Date.now() + 600000
      }

      await addCode(code)
      const codes = await getCodes()

      expect(codes).toHaveLength(1)
      expect(codes[0].code).toBe('abc123')
    })

    test('getCode should retrieve by code value', async () => {
      const codeData = {
        code: 'code123',
        client_id: 'client1',
        expiresAt: Date.now() + 600000
      }

      await addCode(codeData)
      const retrieved = await getCode('code123')

      expect(retrieved).toBeDefined()
      expect(retrieved.client_id).toBe('client1')
    })

    test('getCode should return undefined for unknown code', async () => {
      const code = await getCode('nonexistent')
      expect(code).toBeUndefined()
    })

    test('deleteCode should remove code', async () => {
      await addCode({ code: 'code1', expiresAt: Date.now() + 600000 })
      await addCode({ code: 'code2', expiresAt: Date.now() + 600000 })

      await deleteCode('code1')

      const codes = await getCodes()
      expect(codes).toHaveLength(1)
      expect(codes[0].code).toBe('code2')
    })

    test('deleteCode should handle non-existent code gracefully', async () => {
      await addCode({ code: 'code1', expiresAt: Date.now() + 600000 })

      await deleteCode('nonexistent')

      const codes = await getCodes()
      expect(codes).toHaveLength(1)
    })
  })

  describe('cleanupExpiredCodes', () => {
    test('should remove expired codes', async () => {
      const now = Date.now()

      await addCode({ code: 'valid1', expiresAt: now + 600000 })
      await addCode({ code: 'expired1', expiresAt: now - 60000 })
      await addCode({ code: 'valid2', expiresAt: now + 600000 })
      await addCode({ code: 'expired2', expiresAt: now - 1000 })

      await cleanupExpiredCodes()

      const codes = await getCodes()
      expect(codes).toHaveLength(2)

      const codeValues = codes.map(c => c.code)
      expect(codeValues).toContain('valid1')
      expect(codeValues).toContain('valid2')
      expect(codeValues).not.toContain('expired1')
      expect(codeValues).not.toContain('expired2')
    })

    test('should keep all codes if none expired', async () => {
      const now = Date.now()

      await addCode({ code: 'code1', expiresAt: now + 600000 })
      await addCode({ code: 'code2', expiresAt: now + 600000 })

      await cleanupExpiredCodes()

      const codes = await getCodes()
      expect(codes).toHaveLength(2)
    })

    test('should remove all codes if all expired', async () => {
      const now = Date.now()

      await addCode({ code: 'code1', expiresAt: now - 60000 })
      await addCode({ code: 'code2', expiresAt: now - 60000 })

      await cleanupExpiredCodes()

      const codes = await getCodes()
      expect(codes).toHaveLength(0)
    })
  })
})
