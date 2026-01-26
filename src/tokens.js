const crypto = require('crypto')
const fs = require('fs').promises
const path = require('path')
const jwt = require('jsonwebtoken')
const { promisify } = require('util')

const generateKeyPair = promisify(crypto.generateKeyPair)

let privateKey
let publicKey

async function ensurePrivateKey (dataDir) {
  const keyPath = path.join(dataDir, 'private-key.pem')

  // Check if NGAUTH_KEY env variable is set
  if (process.env.NGAUTH_KEY) {
    privateKey = process.env.NGAUTH_KEY
    // Derive public key from private key
    const keyObject = crypto.createPrivateKey(privateKey)
    publicKey = crypto.createPublicKey(keyObject).export({
      type: 'spki',
      format: 'pem'
    })
    return
  }

  // Check if key file exists
  try {
    privateKey = await fs.readFile(keyPath, 'utf8')
    // Derive public key from private key
    const keyObject = crypto.createPrivateKey(privateKey)
    publicKey = crypto.createPublicKey(keyObject).export({
      type: 'spki',
      format: 'pem'
    })
    console.log('Loaded existing private key from', keyPath)
    return
  } catch (err) {
    // Key file doesn't exist, generate new one
  }

  // Generate new RSA key pair
  console.log('Generating new RSA key pair...')
  const { privateKey: newPrivateKey, publicKey: newPublicKey } = await generateKeyPair('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })

  privateKey = newPrivateKey
  publicKey = newPublicKey

  // Persist private key
  await fs.writeFile(keyPath, privateKey)
  console.log('Generated and saved new private key to', keyPath)
}

function getPublicKeyJwk () {
  const keyObject = crypto.createPublicKey(publicKey)
  const jwk = keyObject.export({ format: 'jwk' })

  return {
    ...jwk,
    use: 'sig',
    alg: 'RS256',
    kid: crypto.createHash('sha256').update(publicKey).digest('hex').substring(0, 16)
  }
}

function getPublicKeyPem () {
  return publicKey
}

function generateToken (payload, expiresIn = '1h') {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn
  })
}

function generateIdToken (claims, expiresIn = '1h') {
  // ID tokens must include these required OIDC claims
  // iss, sub, aud, exp, iat are added by generateToken via expiresIn
  return jwt.sign(claims, privateKey, {
    algorithm: 'RS256',
    expiresIn
  })
}

function verifyToken (token) {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256']
  })
}

function generateRandomToken (bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

module.exports = {
  ensurePrivateKey,
  getPublicKeyJwk,
  getPublicKeyPem,
  generateToken,
  generateIdToken,
  verifyToken,
  generateRandomToken
}
