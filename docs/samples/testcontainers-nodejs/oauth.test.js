/* eslint-env jest */
const { GenericContainer, Wait } = require('testcontainers')
const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')

describe('OAuth 2.0 Integration Tests with ngauth/server', () => {
  let container
  let baseUrl

  // Start ngauth container before all tests
  beforeAll(async () => {
    console.log('Starting ngauth/server container...')

    container = await new GenericContainer('ngauth/server:latest')
      .withExposedPorts(3000)
      .withWaitStrategy(
        Wait.forHttp('/.well-known/oauth-authorization-server', 3000)
          .forStatusCode(200)
      )
      .start()

    const host = container.getHost()
    const port = container.getMappedPort(3000)
    baseUrl = `http://${host}:${port}`

    console.log(`ngauth/server running at ${baseUrl}`)
  }, 60000) // 60 second timeout for container startup

  // Stop container after all tests
  afterAll(async () => {
    if (container) {
      await container.stop()
      console.log('Container stopped')
    }
  })

  describe('Server Metadata', () => {
    test('should return OAuth server metadata', async () => {
      const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)
      expect(response.status).toBe(200)

      const metadata = await response.json()

      expect(metadata.issuer).toBe(baseUrl)
      expect(metadata.authorization_endpoint).toBe(`${baseUrl}/authorize`)
      expect(metadata.token_endpoint).toBe(`${baseUrl}/token`)
      expect(metadata.jwks_uri).toBe(`${baseUrl}/.well-known/jwks.json`)
      expect(metadata.grant_types_supported).toContain('authorization_code')
      expect(metadata.grant_types_supported).toContain('client_credentials')
      expect(metadata.response_types_supported).toContain('code')
    })

    test('should return JWKS endpoint', async () => {
      const response = await fetch(`${baseUrl}/.well-known/jwks.json`)
      expect(response.status).toBe(200)

      const jwks = await response.json()

      expect(jwks.keys).toBeDefined()
      expect(jwks.keys.length).toBeGreaterThan(0)
      expect(jwks.keys[0].kty).toBe('RSA')
      expect(jwks.keys[0].alg).toBe('RS256')
      expect(jwks.keys[0].use).toBe('sig')
      expect(jwks.keys[0].kid).toBeDefined()
    })
  })

  describe('Dynamic Client Registration', () => {
    test('should register a new OAuth client', async () => {
      const response = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Test Application',
          redirect_uris: ['http://localhost:3001/callback']
        })
      })

      expect(response.status).toBe(201)

      const client = await response.json()

      expect(client.client_id).toBeDefined()
      expect(client.client_secret).toBeDefined()
      expect(client.client_name).toBe('Test Application')
      expect(client.redirect_uris).toContain('http://localhost:3001/callback')
      expect(client.token_endpoint_auth_method).toBe('client_secret_basic')
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
    let client

    beforeAll(async () => {
      // Register a client for testing
      const response = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Client Credentials Test',
          redirect_uris: ['http://localhost/callback']
        })
      })
      client = await response.json()
    })

    test('should issue access token via client credentials', async () => {
      const auth = Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64')

      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials&scope=openid profile'
      })

      expect(response.status).toBe(200)

      const tokenData = await response.json()

      expect(tokenData.access_token).toBeDefined()
      expect(tokenData.token_type).toBe('Bearer')
      expect(tokenData.expires_in).toBe(3600)
      expect(tokenData.scope).toBe('openid profile')
    })

    test('should reject invalid client credentials', async () => {
      const auth = Buffer.from(`${client.client_id}:wrong_secret`).toString('base64')

      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      })

      expect(response.status).toBe(401)

      const error = await response.json()
      expect(error.error).toBe('invalid_client')
    })

    test('should support client_secret_post authentication', async () => {
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=client_credentials&client_id=${client.client_id}&client_secret=${client.client_secret}&scope=openid`
      })

      expect(response.status).toBe(200)

      const tokenData = await response.json()
      expect(tokenData.access_token).toBeDefined()
    })
  })

  describe('JWT Token Verification', () => {
    let client
    let accessToken

    beforeAll(async () => {
      // Register client and get token
      const registerResponse = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'JWT Test Client',
          redirect_uris: ['http://localhost/callback']
        })
      })
      client = await registerResponse.json()

      const auth = Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64')
      const tokenResponse = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials&scope=openid'
      })
      const tokenData = await tokenResponse.json()
      accessToken = tokenData.access_token
    })

    test('should verify JWT token signature with JWKS', async () => {
      // Create JWKS client
      const client = jwksClient({
        jwksUri: `${baseUrl}/.well-known/jwks.json`,
        cache: true,
        rateLimit: true
      })

      // Decode token to get kid
      const decoded = jwt.decode(accessToken, { complete: true })
      expect(decoded.header.kid).toBeDefined()

      // Get signing key
      const key = await client.getSigningKey(decoded.header.kid)
      const signingKey = key.getPublicKey()

      // Verify token
      const verified = jwt.verify(accessToken, signingKey, {
        algorithms: ['RS256']
      })

      expect(verified.client_id).toBe(client.client_id)
      expect(verified.scope).toBe('openid')
      expect(verified.iss).toBe(baseUrl)
    })

    test('should decode JWT token claims', async () => {
      const decoded = jwt.decode(accessToken)

      expect(decoded.client_id).toBeDefined()
      expect(decoded.scope).toBe('openid')
      expect(decoded.iss).toBe(baseUrl)
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
      expect(decoded.exp - decoded.iat).toBe(3600) // 1 hour
    })
  })

  describe('Authorization Code Flow', () => {
    let client

    beforeAll(async () => {
      const response = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Auth Code Test',
          redirect_uris: ['http://localhost:3001/callback']
        })
      })
      client = await response.json()
    })

    test('should render authorization form', async () => {
      const url = `${baseUrl}/authorize?response_type=code&client_id=${client.client_id}&redirect_uri=http://localhost:3001/callback&scope=openid&state=random_state`

      const response = await fetch(url)
      expect(response.status).toBe(200)

      const html = await response.text()
      expect(html).toContain('OAuth Login')
      expect(html).toContain('username')
      expect(html).toContain('password')
    })

    test('should reject invalid redirect_uri', async () => {
      const url = `${baseUrl}/authorize?response_type=code&client_id=${client.client_id}&redirect_uri=http://evil.com/callback&scope=openid&state=state123`

      const response = await fetch(url, { redirect: 'manual' })
      expect(response.status).toBe(400)

      const error = await response.json()
      expect(error.error).toBe('invalid_request')
    })

    test('should reject missing client_id', async () => {
      const url = `${baseUrl}/authorize?response_type=code&redirect_uri=http://localhost:3001/callback&scope=openid`

      const response = await fetch(url)
      expect(response.status).toBe(400)

      const error = await response.json()
      expect(error.error).toBe('invalid_request')
    })
  })

  describe('User Login', () => {
    test('should login with default test user', async () => {
      const response = await fetch(`${baseUrl}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'testpass'
        })
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.token).toBeDefined()
      expect(data.user.username).toBe('testuser')
    })

    test('should reject invalid credentials', async () => {
      const response = await fetch(`${baseUrl}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'wrongpassword'
        })
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Error Handling', () => {
    test('should return proper OAuth error for unsupported grant type', async () => {
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=password&username=test&password=test'
      })

      expect(response.status).toBe(400)

      const error = await response.json()
      expect(error.error).toBe('unsupported_grant_type')
      expect(error.error_description).toBeDefined()
    })

    test('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${baseUrl}/nonexistent`)
      expect(response.status).toBe(404)
    })
  })
})
