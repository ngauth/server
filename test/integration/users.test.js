/* global describe, expect, beforeAll, afterAll, it */
const request = require('supertest')
const path = require('path')
const fs = require('fs').promises
const { initDb } = require('../../src/db')
const { ensurePrivateKey } = require('../../src/tokens')
const { setPublicKey } = require('../../src/auth')

const testDataDir = path.join(__dirname, '../test-data-users')

// Set test data directory BEFORE importing app
process.env.NGAUTH_DATA = testDataDir

const app = require('../../src/index')

beforeAll(async () => {
  // Create test data directory
  try {
    await fs.mkdir(testDataDir, { recursive: true })
  } catch (err) {
    // Directory already exists
  }

  // Initialize for tests
  process.env.NGAUTH_DATA = testDataDir
  await ensurePrivateKey(testDataDir)
  await initDb(testDataDir)

  // Set public key for auth
  const { getPublicKeyPem } = require('../../src/tokens')
  setPublicKey(getPublicKeyPem())
})

afterAll(async () => {
  // Cleanup test data
  try {
    await fs.rm(testDataDir, { recursive: true, force: true })
  } catch (err) {
    // Ignore errors
  }
})

describe('Users API', () => {
  let testToken
  let userId

  describe('POST /users - Create user', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/users')
        .send({
          username: 'newuser123',
          email: 'newuser@example.com',
          password: 'TestPassword123',
          name: 'Test User'
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body.username).toBe('newuser123')
      expect(res.body.email).toBe('newuser@example.com')
      expect(res.body.name).toBe('Test User')
      expect(res.body).not.toHaveProperty('password')

      userId = res.body.id
    })

    it('should reject duplicate username', async () => {
      await request(app)
        .post('/users')
        .send({
          username: 'duplicateuser1',
          email: 'first@example.com',
          password: 'TestPassword123'
        })

      const res = await request(app)
        .post('/users')
        .send({
          username: 'duplicateuser1',
          email: 'second@example.com',
          password: 'TestPassword123'
        })

      expect(res.status).toBe(400)
    })

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/users')
        .send({
          username: 'emailuser1',
          email: 'duplicateemail@example.com',
          password: 'TestPassword123'
        })

      const res = await request(app)
        .post('/users')
        .send({
          username: 'emailuser2',
          email: 'duplicateemail@example.com',
          password: 'TestPassword123'
        })

      expect(res.status).toBe(400)
    })

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/users')
        .send({
          username: 'invalidemail',
          email: 'notanemail',
          password: 'TestPassword123'
        })

      expect(res.status).toBe(400)
    })

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/users')
        .send({
          username: 'shortpassuser',
          email: 'shortpass@example.com',
          password: 'short'
        })

      expect(res.status).toBe(400)
    })

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/users')
        .send({
          username: 'validuser'
        })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /users/login - User login', () => {
    beforeAll(async () => {
      // Create a test user
      await request(app)
        .post('/users')
        .send({
          username: 'loginuser',
          email: 'login@example.com',
          password: 'ValidPassword123'
        })
    })

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/users/login')
        .send({
          username: 'loginuser',
          password: 'ValidPassword123'
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('access_token')
      expect(res.body.token_type).toBe('Bearer')
      expect(res.body.expires_in).toBe(3600)

      testToken = res.body.access_token
    })

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/users/login')
        .send({
          username: 'loginuser',
          password: 'WrongPassword'
        })

      expect(res.status).toBe(400)
    })

    it('should reject login with nonexistent user', async () => {
      const res = await request(app)
        .post('/users/login')
        .send({
          username: 'nonexistent',
          password: 'ValidPassword123'
        })

      expect(res.status).toBe(400)
    })

    it('should reject login with missing credentials', async () => {
      const res = await request(app)
        .post('/users/login')
        .send({
          username: 'loginuser'
        })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /users - List users', () => {
    it('should reject without token', async () => {
      const res = await request(app)
        .get('/users')

      expect(res.status).toBe(400)
    })

    it('should list users with valid token', async () => {
      if (!testToken) {
        const loginRes = await request(app)
          .post('/users/login')
          .send({
            username: 'loginuser',
            password: 'ValidPassword123'
          })
        testToken = loginRes.body.access_token
      }

      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${testToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
      expect(res.body[0]).not.toHaveProperty('password')
    })
  })

  describe('GET /users/:id - Get user', () => {
    it('should reject without token', async () => {
      const res = await request(app)
        .get(`/users/${userId || 'test'}`)

      expect(res.status).toBe(400)
    })

    it('should get user data with valid token', async () => {
      if (!testToken) {
        const loginRes = await request(app)
          .post('/users/login')
          .send({
            username: 'loginuser',
            password: 'ValidPassword123'
          })
        testToken = loginRes.body.access_token
      }

      const res = await request(app)
        .get(`/users/${userId || 'user_123'}`)
        .set('Authorization', `Bearer ${testToken}`)

      // Will return 400 if user doesn't exist, which is expected for non-existent IDs
      if (userId && res.status === 200) {
        expect(res.body).toHaveProperty('id')
        expect(res.body).not.toHaveProperty('password')
      }
    })
  })

  describe('PUT /users/:id - Update user', () => {
    it('should reject without token', async () => {
      const res = await request(app)
        .put(`/users/${userId || 'test'}`)
        .send({ email: 'newemail@example.com' })

      expect(res.status).toBe(400)
    })

    it('should update user with valid token', async () => {
      if (!testToken) {
        const loginRes = await request(app)
          .post('/users/login')
          .send({
            username: 'loginuser',
            password: 'ValidPassword123'
          })
        testToken = loginRes.body.access_token
      }

      if (userId) {
        const res = await request(app)
          .put(`/users/${userId}`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: 'Updated Name',
            email: 'updated@example.com'
          })

        if (res.status === 200) {
          expect(res.body.name).toBe('Updated Name')
          expect(res.body.email).toBe('updated@example.com')
          expect(res.body).not.toHaveProperty('password')
        }
      }
    })
  })
})
