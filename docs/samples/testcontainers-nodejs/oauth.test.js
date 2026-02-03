const { GenericContainer, Wait } = require('testcontainers')
const fetch = require('node-fetch')
const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')

describe('OAuth 2.0 Integration Tests with ngauth', () => {
  let container
  let baseUrl
  let client

  beforeAll(async () => {
    console.log('Starting ngauth container...')
    
    container = await new GenericContainer('ngauth/server:1.0.0')
      .withExposedPorts(3000)
      .withEnvironment({
        NODE_ENV: 'development',
        JWT_SECRET: 'test-secret-key-min-32-chars-long!',
        SESSION_SECRET: 'test-session-secret-min-32-chars!',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'admin123'
      })
      .withWaitStrategy(Wait.forLogMessage('listening on port 3000'))
      .start()

    const host = container.getHost()
    const port = container.getMappedPort(3000)
    baseUrl = `http://${host}:${port}`
    console.log(`ngauth running at ${baseUrl}`)

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Register a client for tests
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Test Client',
        redirect_uris: ['http://localhost:3001/callback'],
        grant_types: ['client_credentials', 'authorization_code'],
        scope: 'openid profile email read write'
      })
    })
    
    client = await response.json()
    console.log('Client registered:', client.client_id)
  }, 60000)

  afterAll(async () => {
    if (container) {
      await container.stop()
      console.log('Container stopped')
    }
  })

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const response = await fetch(`${baseUrl}/health/live`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.status).toBe('ok')
    })

    test('should return readiness status', async () => {
      const response = await fetch(`${baseUrl}/health/ready`)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.status).toBe('ready')
      expect(data.checks.keys).toBe(true)
      expect(data.checks.database).toBe(true)
    })
  })

  describe('OIDC Discovery', () => {
    test('should return OIDC configuration', async () => {
      const response = await fetch(`${baseUrl}/.well-known/openid-configuration`)
      expect(response.status).toBe(200)

      const metadata = await response.json()
      expect(metadata.issuer).toBeDefined()
      expect(metadata.authorization_endpoint).toBeDefined()
      expect(metadata.token_endpoint).toBeDefined()
      expect(metadata.jwks_uri).toBeDefined()
      expect(metadata.registration_endpoint).toBe(`${metadata.issuer}/register`)
    })

    test('should return JWKS endpoint', async () => {
      const response = await fetch(`${baseUrl}/.well-known/jwks.json`)
      expect(response.status).toBe(200)

      const jwks = await response.json()
      expect(jwks.keys).toBeDefined()
      expect(Array.isArray(jwks.keys)).toBe(true)
      expect(jwks.keys.length).toBeGreaterThan(0)
      expect(jwks.keys[0].kty).toBe('RSA')
    })
  })

  describe('Dynamic Client Registration', () => {
    test('should register a new OAuth client', async () => {
      const response = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Test Application',
          redirect_uris: ['http://localhost:3001/callback'],
          grant_types: ['authorization_code'],
          scope: 'openid profile'
        })
      })

      expect(response.status).toBe(201)

      const newClient = await response.json()
      expect(newClient.client_id).toBeDefined()
      expect(newClient.client_secret).toBeDefined()
      expect(newClient.client_name).toBe('Test Application')
      expect(newClient.redirect_uris).toContain('http://localhost:3001/callback')
    })

    test('should reject registration without redirect_uris', async () => {
      const response = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Invalid Client'
        })
      })

      expect(response.status).toBe(400)

      const error = await response.json()
      expect(error.error).toBe('invalid_request')
    })
  })

  describe('Client Credentials Grant', () => {
    test('should issue access token via client credentials', async () => {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.client_id,
        client_secret: client.client_secret,
        scope: 'read write'
      })

      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      })

      expect(response.status).toBe(200)

      const tokenData = await response.json()
      expect(tokenData.access_token).toBeDefined()
      expect(tokenData.token_type).toBe('Bearer')
      expect(tokenData.expires_in).toBeDefined()
    })

    test('should reject invalid client credentials', async () => {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'invalid_client',
        client_secret: 'invalid_secret'
      })

      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      })

      expect(response.status).toBe(400)

      const error = await response.json()
      expect(error.error).toBe('invalid_client')
    })

    test('should support client_secret_post authentication', async () => {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.client_id,
        client_secret: client.client_secret,
        scope: 'openid'
      })

      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      })

      expect(response.status).toBe(200)
    })
  })

  describe('JWT Token Verification', () => {
    let accessToken

    beforeAll(async () => {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.client_id,
        client_secret: client.client_secret,
        scope: 'openid'
      })

      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      })

      const data = await response.json()
      accessToken = data.access_token
    })

    test('should verify JWT token signature with JWKS', async () => {
      const jwksUri = `${baseUrl}/.well-known/jwks.json`
      const jwksClientInstance = jwksClient({ jwksUri })

      // Decode token to get kid
      const decoded = jwt.decode(accessToken, { complete: true })
      expect(decoded).toBeDefined()
      expect(decoded.header.kid).toBeDefined()

      // Get signing key
      const key = await jwksClientInstance.getSigningKey(decoded.header.kid)
      const signingKey = key.getPublicKey()

      // Verify token
      const verified = jwt.verify(accessToken, signingKey, {
        algorithms: ['RS256']
      })

      expect(verified).toBeDefined()
      expect(verified.client_id).toBe(client.client_id)
    })

    test('should decode JWT token claims', async () => {
      const decoded = jwt.decode(accessToken)

      expect(decoded.client_id).toBeDefined()
      expect(decoded.scope).toBeDefined()
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
      expect(decoded.exp - decoded.iat).toBe(3600) // 1 hour
    })
  })

  describe('Authorization Code Flow', () => {
    beforeEach(async () => {
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    test('should render authorization form', async () => {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: client.client_id,
        redirect_uri: 'http://localhost:3001/callback',
        scope: 'openid',
        state: 'random_state'
      })

      const response = await fetch(`${baseUrl}/authorize?${params}`)
      expect(response.status).toBe(200)

      const html = await response.text()
      expect(html).toContain('Login')
    })

    test('should reject invalid redirect_uri', async () => {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: client.client_id,
        redirect_uri: 'http://evil.com/callback',
        scope: 'openid'
      })

      const response = await fetch(`${baseUrl}/authorize?${params}`, {
        redirect: 'manual'
      })

      // Accept 400 (validation error) or 429 (rate limited)
      expect([400, 429]).toContain(response.status)
    })

    test('should reject missing client_id', async () => {
      const params = new URLSearchParams({
        response_type: 'code',
        redirect_uri: 'http://localhost:3001/callback',
        scope: 'openid'
      })

      const response = await fetch(`${baseUrl}/authorize?${params}`)
      // Accept 400 (validation error) or 429 (rate limited)
      expect([400, 429]).toContain(response.status)
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    test('should return proper OAuth error for unsupported grant type', async () => {
      const params = new URLSearchParams({
        grant_type: 'unsupported_grant',
        client_id: client.client_id,
        client_secret: client.client_secret
      })

      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      })

      // Accept 400 (validation error) or 429 (rate limited)
      expect([400, 429]).toContain(response.status)

      if (response.status === 400) {
        const error = await response.json()
        expect(error.error).toBe('unsupported_grant_type')
        expect(error.error_description).toBeDefined()
      }
    })

    test('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${baseUrl}/nonexistent`)
      expect(response.status).toBe(404)
    })
  })
})
