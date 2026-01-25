/* eslint camelcase: "off" */
/* global describe, test, expect, beforeEach, afterEach */
const request = require('supertest')
const express = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { initDb } = require('../../src/db')
const { ensurePrivateKey: ensureTokenKey } = require('../../src/tokens')
const wellKnownRouter = require('../../src/routes/well-known')
const jwksRouter = require('../../src/routes/jwks')
const registerRouter = require('../../src/routes/register')
const { errorHandler } = require('../../src/errors')

describe('Well-Known Routes', () => {
  let app
  let testDir

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-test-'))
    await initDb(testDir)
    await ensureTokenKey(testDir)

    app = express()
    app.use(express.json())
    app.use('/.well-known', wellKnownRouter)
    app.use('/.well-known', jwksRouter)
    app.use(errorHandler)
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('GET /.well-known/oauth-authorization-server', () => {
    test('should return metadata with required fields', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server')

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/json/)
      expect(res.body).toHaveProperty('issuer')
      expect(res.body).toHaveProperty('authorization_endpoint')
      expect(res.body).toHaveProperty('token_endpoint')
      expect(res.body).toHaveProperty('jwks_uri')
    })

    test('should include supported grant types', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server')

      expect(res.body.grant_types_supported).toContain('authorization_code')
      expect(res.body.grant_types_supported).toContain('client_credentials')
    })

    test('should include supported response types', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server')

      expect(res.body.response_types_supported).toContain('code')
    })

    test('should include supported auth methods', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server')

      expect(res.body.token_endpoint_auth_methods_supported).toContain('client_secret_basic')
      expect(res.body.token_endpoint_auth_methods_supported).toContain('client_secret_post')
    })

    test('should include registration endpoint', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server')

      expect(res.body.registration_endpoint).toBeDefined()
      expect(res.body.registration_endpoint).toContain('/register')
    })
  })

  describe('GET /.well-known/jwks.json', () => {
    test('should return JWKS with keys array', async () => {
      const res = await request(app)
        .get('/.well-known/jwks.json')

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/json/)
      expect(res.body).toHaveProperty('keys')
      expect(Array.isArray(res.body.keys)).toBe(true)
      expect(res.body.keys.length).toBeGreaterThan(0)
    })

    test('should return valid JWK format', async () => {
      const res = await request(app)
        .get('/.well-known/jwks.json')

      const jwk = res.body.keys[0]
      expect(jwk).toHaveProperty('kty')
      expect(jwk).toHaveProperty('use', 'sig')
      expect(jwk).toHaveProperty('alg', 'RS256')
      expect(jwk).toHaveProperty('kid')
      expect(jwk).toHaveProperty('n')
      expect(jwk).toHaveProperty('e')
    })
  })
})

describe('Client Registration Route', () => {
  let app
  let testDir

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-test-'))
    await initDb(testDir)

    app = express()
    app.use(express.json())
    app.use('/register', registerRouter)
    app.use(errorHandler)
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('POST /register', () => {
    test('should register new client with redirect_uris', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          redirect_uris: ['http://localhost:3000/callback']
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('client_id')
      expect(res.body).toHaveProperty('client_secret')
      expect(res.body.redirect_uris).toEqual(['http://localhost:3000/callback'])
    })

    test('should generate unique client credentials', async () => {
      const res1 = await request(app)
        .post('/register')
        .send({ redirect_uris: ['http://localhost/callback1'] })

      const res2 = await request(app)
        .post('/register')
        .send({ redirect_uris: ['http://localhost/callback2'] })

      expect(res1.body.client_id).not.toBe(res2.body.client_id)
      expect(res1.body.client_secret).not.toBe(res2.body.client_secret)
    })

    test('should accept optional client_name', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          redirect_uris: ['http://localhost/callback'],
          client_name: 'My Test App'
        })

      expect(res.status).toBe(201)
      expect(res.body.client_name).toBe('My Test App')
    })

    test('should set default grant_types', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          redirect_uris: ['http://localhost/callback']
        })

      expect(res.body.grant_types).toEqual(['authorization_code'])
    })

    test('should accept custom grant_types', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          redirect_uris: ['http://localhost/callback'],
          grant_types: ['authorization_code', 'client_credentials']
        })

      expect(res.body.grant_types).toEqual(['authorization_code', 'client_credentials'])
    })

    test('should reject request without redirect_uris', async () => {
      const res = await request(app)
        .post('/register')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    })

    test('should reject empty redirect_uris array', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          redirect_uris: []
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    })

    test('should support multiple redirect_uris', async () => {
      const uris = [
        'http://localhost:3000/callback',
        'http://localhost:3001/callback',
        'https://example.com/oauth/callback'
      ]

      const res = await request(app)
        .post('/register')
        .send({
          redirect_uris: uris
        })

      expect(res.status).toBe(201)
      expect(res.body.redirect_uris).toEqual(uris)
    })
  })
})
