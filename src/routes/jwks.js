const express = require('express')
const { getPublicKeyJwk } = require('../tokens')

const router = express.Router()

router.get('/jwks.json', (req, res) => {
  const jwk = getPublicKeyJwk()

  res.json({
    keys: [jwk]
  })
})

module.exports = router
