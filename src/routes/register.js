/* eslint camelcase: "off" */
const express = require('express')
const crypto = require('crypto')
const { addClient } = require('../db')
const { OAuthError } = require('../errors')

const router = express.Router()

router.post('/', async (req, res, next) => {
  try {
    const { redirect_uris, client_name, grant_types, response_types, scope } = req.body

    // Validate required parameters (RFC 7591)
    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return next(new OAuthError('invalid_request', 'redirect_uris is required and must be a non-empty array'))
    }

    // Validate redirect URIs are valid URLs
    for (const uri of redirect_uris) {
      if (typeof uri !== 'string') {
        return next(new OAuthError('invalid_request', 'All redirect_uris must be strings'))
      }
      try {
        // eslint-disable-next-line no-new
        new URL(uri)
      } catch (err) {
        return next(new OAuthError('invalid_request', `Invalid redirect_uri: ${uri}`))
      }
    }

    // Validate client_name length
    if (client_name && typeof client_name === 'string' && client_name.length > 255) {
      return next(new OAuthError('invalid_request', 'client_name must not exceed 255 characters'))
    }

    // Generate client credentials
    const client_id = crypto.randomBytes(16).toString('hex')
    const client_secret = crypto.randomBytes(32).toString('hex')

    const client = {
      client_id,
      client_secret,
      client_name: client_name || `Client ${client_id}`,
      redirect_uris,
      grant_types: grant_types || ['authorization_code'],
      response_types: response_types || ['code'],
      scope: scope || '',
      created_at: Date.now()
    }

    await addClient(client)

    // Return client metadata (RFC 7591 3.2.1)
    res.status(201).json({
      client_id: client.client_id,
      client_secret: client.client_secret,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      scope: client.scope
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
