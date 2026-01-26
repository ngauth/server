/* eslint-env jest */

/**
 * Health Check Endpoints Tests
 */

const request = require('supertest')
const app = require('../../src/index')

describe('Health Check Endpoints', () => {
  describe('GET /health/live', () => {
    test('should return 200 when application is running', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200)

      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('timestamp')
    })

    test('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200)

      const timestamp = new Date(response.body.timestamp)
      expect(timestamp.toISOString()).toBe(response.body.timestamp)
    })
  })

  describe('GET /health/ready', () => {
    test('should return 200 when application is ready', async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 200))

      const response = await request(app)
        .get('/health/ready')
        .expect(200)

      expect(response.body).toHaveProperty('status', 'ready')
      expect(response.body).toHaveProperty('checks')
      expect(response.body.checks.keys).toBe(true)
      expect(response.body.checks.database).toBe(true)
      expect(response.body).toHaveProperty('timestamp')
    })

    test('should include checks for keys and database', async () => {
      await new Promise(resolve => setTimeout(resolve, 200))

      const response = await request(app)
        .get('/health/ready')

      expect(response.body.checks).toHaveProperty('keys')
      expect(response.body.checks).toHaveProperty('database')
    })
  })

  describe('GET /health/startup', () => {
    test('should return 200 when startup is complete', async () => {
      // Wait for key initialization
      await new Promise(resolve => setTimeout(resolve, 200))

      const response = await request(app)
        .get('/health/startup')
        .expect(200)

      expect(response.body).toHaveProperty('status', 'started')
      expect(response.body).toHaveProperty('timestamp')
    })
  })
})
