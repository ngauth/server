/* eslint camelcase: "off" */
/* global describe, test, expect, beforeEach, afterEach */
const request = require('supertest')
const express = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { initDb, addClient, addCode } = require('../../src/db')
const { ensurePrivateKey } = require('../../src/tokens')
const tokenRouter = require('../../src/routes/token')
const { errorHandler } = require('../../src/errors')

describe('Token Endpoint', () => {
  let app
  let testDir

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-test-'))
    await initDb(testDir)
    await ensurePrivateKey(testDir)

    app = express()
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    app.use('/token', tokenRouter)
    app.use(errorHandler)

    // Add test client
    addClient({
      client_id: 'test-client',
      client_secret: 'test-secret',
      redirect_uris: ['http://localhost:3000/callback']
    })
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('POST /token - client_credentials grant', () => {
    test('should issue token with client_secret_post', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'test-client',
          client_secret: 'test-secret',
          scope: 'read write'
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('access_token')
      expect(res.body.token_type).toBe('Bearer')
      expect(res.body.expires_in).toBe(3600)
      expect(res.body.scope).toBe('read write')
    })

    test('should issue token with client_secret_basic', async () => {
      const credentials = Buffer.from('test-client:test-secret').toString('base64')

      const res = await request(app)
        .post('/token')
        .set('Authorization', `Basic ${credentials}`)
        .send({
          grant_type: 'client_credentials'
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('access_token')
      expect(res.body.token_type).toBe('Bearer')
    })

    test('should reject invalid client credentials', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'test-client',
          client_secret: 'wrong-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_client')
    })

    test('should reject missing client credentials', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'client_credentials'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_client')
    })

    test('should handle empty scope', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'client_credentials',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(200)
      expect(res.body.scope).toBe('')
    })
  })

  describe('POST /token - authorization_code grant', () => {
    beforeEach(async () => {
      // Add valid authorization code
      await addCode({
        code: 'valid-code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
        userId: 'user1',
        expiresAt: Date.now() + 600000
      })
    })

    test('should exchange valid code for token', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          code: 'valid-code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('access_token')
      expect(res.body.token_type).toBe('Bearer')
      expect(res.body.expires_in).toBe(3600)
      expect(res.body.scope).toBe('read')
    })

    test('should reject code reuse (single-use)', async () => {
      // First request should succeed
      await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          code: 'valid-code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      // Second request should fail
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          code: 'valid-code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_grant')
    })

    test('should reject invalid code', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid-code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_grant')
    })

    test('should reject expired code', async () => {
      await addCode({
        code: 'expired-code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'read',
        userId: 'user1',
        expiresAt: Date.now() - 1000
      })

      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          code: 'expired-code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_grant')
    })

    test('should reject mismatched redirect_uri', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          code: 'valid-code',
          redirect_uri: 'http://evil.com/callback',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_grant')
      expect(res.body.error_description).toContain('mismatch')
    })

    test('should reject code issued to different client', async () => {
      await addClient({
        client_id: 'other-client',
        client_secret: 'other-secret',
        redirect_uris: ['http://localhost:3000/callback']
      })

      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          code: 'valid-code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'other-client',
          client_secret: 'other-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_grant')
    })

    test('should require code parameter', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost:3000/callback',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    })

    test('should require redirect_uri parameter', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          code: 'valid-code',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    })
  })

  describe('POST /token - unsupported grant types', () => {
    test('should reject unsupported grant_type', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'password',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('unsupported_grant_type')
    })

    test('should reject implicit grant', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'implicit',
          client_id: 'test-client',
          client_secret: 'test-secret'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('unsupported_grant_type')
    })
  })
})
