/* eslint camelcase: "off" */
/* global describe, test, expect, beforeEach, afterEach */
const request = require('supertest')
const express = require('express')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { initDb, addClient, getCodes } = require('../../src/db')
const { ensurePrivateKey } = require('../../src/tokens')
const authorizeRouter = require('../../src/routes/authorize')
const { errorHandler } = require('../../src/errors')

describe('Authorization Endpoint', () => {
  let app
  let testDir

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-test-'))
    await initDb(testDir)
    await ensurePrivateKey(testDir)

    app = express()
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    app.use(cookieParser(crypto.randomBytes(32).toString('hex')))
    app.use(session({
      secret: crypto.randomBytes(32).toString('hex'),
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }))

    app.use('/authorize', authorizeRouter)
    app.use(errorHandler)

    // Add test client
    await addClient({
      client_id: 'test-client',
      client_secret: 'test-secret',
      redirect_uris: ['http://localhost:3000/callback', 'http://localhost:3001/callback']
    })
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('GET /authorize', () => {
    test('should show login form for unauthenticated user', async () => {
      const res = await request(app)
        .get('/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'code'
        })

      expect(res.status).toBe(200)
      expect(res.text).toContain('Sign In')
      expect(res.text).toContain('username')
      expect(res.text).toContain('password')
    })

    test('should require client_id parameter', async () => {
      const res = await request(app)
        .get('/authorize')
        .query({
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'code'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
      expect(res.body.error_description).toContain('client_id')
    })

    test('should require redirect_uri parameter', async () => {
      const res = await request(app)
        .get('/authorize')
        .query({
          client_id: 'test-client',
          response_type: 'code'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
      expect(res.body.error_description).toContain('redirect_uri')
    })

    test('should require response_type=code', async () => {
      const res = await request(app)
        .get('/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'token'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('unsupported_response_type')
    })

    test('should reject invalid client_id', async () => {
      const res = await request(app)
        .get('/authorize')
        .query({
          client_id: 'invalid-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'code'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('unauthorized_client')
    })

    test('should reject unregistered redirect_uri', async () => {
      const res = await request(app)
        .get('/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'http://evil.com/callback',
          response_type: 'code'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
      expect(res.body.error_description).toContain('redirect_uri')
    })

    test('should include scope in login form', async () => {
      const res = await request(app)
        .get('/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'code',
          scope: 'read write'
        })

      expect(res.status).toBe(200)
      expect(res.text).toContain('read write')
    })

    test('should include state in login form', async () => {
      const res = await request(app)
        .get('/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          response_type: 'code',
          state: 'xyz123'
        })

      expect(res.status).toBe(200)
      expect(res.text).toContain('xyz123')
    })
  })

  describe('POST /authorize', () => {
    // Helper function to extract CSRF token from login form
    // This must maintain cookies across requests
    const getCsrfTokenAndCookies = async (query) => {
      const res = await request(app)
        .get('/authorize')
        .query(query)

      const match = res.text.match(/name="_csrf" value="([^"]+)"/)
      const token = match ? match[1] : null
      const cookies = res.headers['set-cookie'] || []
      return { token, cookies }
    }

    test('should authenticate and redirect with code', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code'
      })

      if (!csrfToken) {
        throw new Error('CSRF token extraction failed - token is null')
      }

      const res = await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'testuser',
          password: 'testpass',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          scope: 'read'
        })

      expect(res.status).toBe(302)
      expect(res.headers.location).toMatch(/^http:\/\/localhost:3000\/callback\?code=/)

      const url = new URL(res.headers.location)
      expect(url.searchParams.has('code')).toBe(true)

      const code = url.searchParams.get('code')
      expect(code).toBeTruthy()
      expect(code.length).toBeGreaterThan(0)
    })

    test('should preserve state parameter in redirect', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code',
        state: 'abc123'
      })

      const res = await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'testuser',
          password: 'testpass',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          state: 'abc123'
        })

      expect(res.status).toBe(302)
      const url = new URL(res.headers.location)
      expect(url.searchParams.get('state')).toBe('abc123')
    })

    test('should reject invalid credentials', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code'
      })

      const res = await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'testuser',
          password: 'wrongpass',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback'
        })

      expect(res.status).toBe(200)
      expect(res.text).toContain('Invalid username or password')
    })

    test('should reject unknown username', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code'
      })

      const res = await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'unknown',
          password: 'testpass',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback'
        })

      expect(res.status).toBe(200)
      expect(res.text).toContain('Invalid username or password')
    })

    test('should store authorization code with correct data', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code'
      })

      const res = await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'testuser',
          password: 'testpass',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback',
          scope: 'read write'
        })

      expect(res.status).toBe(302)

      const codes = await getCodes()
      expect(codes).toHaveLength(1)
      expect(codes[0].client_id).toBe('test-client')
      expect(codes[0].redirect_uri).toBe('http://localhost:3000/callback')
      expect(codes[0].scope).toBe('read write')
      expect(codes[0].userId).toBe('user1')
    })

    test('should create short-lived authorization code', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code'
      })

      const before = Date.now()

      await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'testuser',
          password: 'testpass',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3000/callback'
        })

      const after = Date.now()
      const codes = await getCodes()
      const expiresAt = codes[0].expiresAt

      // Should expire in approximately 10 minutes
      const minExpiry = before + (9 * 60 * 1000)
      const maxExpiry = after + (11 * 60 * 1000)

      expect(expiresAt).toBeGreaterThan(minExpiry)
      expect(expiresAt).toBeLessThan(maxExpiry)
    })

    test('should support multiple redirect URIs', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3001/callback',
        response_type: 'code'
      })

      const res = await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'testuser',
          password: 'testpass',
          client_id: 'test-client',
          redirect_uri: 'http://localhost:3001/callback'
        })

      expect(res.status).toBe(302)
      expect(res.headers.location).toMatch(/^http:\/\/localhost:3001\/callback\?code=/)
    })

    test('should reject invalid client on POST', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code'
      })

      const res = await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'testuser',
          password: 'testpass',
          client_id: 'invalid-client',
          redirect_uri: 'http://localhost:3000/callback'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('unauthorized_client')
    })

    test('should reject invalid redirect_uri on POST', async () => {
      const { token: csrfToken, cookies } = await getCsrfTokenAndCookies({
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        response_type: 'code'
      })

      const res = await request(app)
        .post('/authorize')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          username: 'testuser',
          password: 'testpass',
          client_id: 'test-client',
          redirect_uri: 'http://evil.com/callback'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    })
  })
})
