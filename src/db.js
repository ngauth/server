const fs = require('fs').promises
const path = require('path')
const { hashPassword } = require('./users')

let dataDir

async function initDb (dir) {
  dataDir = dir

  // Initialize empty data files if they don't exist
  const clientsFile = path.join(dataDir, 'clients.json')
  try {
    await fs.access(clientsFile)
  } catch {
    await fs.writeFile(clientsFile, JSON.stringify([], null, 2))
  }

  const usersFile = path.join(dataDir, 'users.json')
  try {
    await fs.access(usersFile)
  } catch {
    // Seed a default test user with hashed password
    const hashedPassword = await hashPassword('testpass')
    const defaultUsers = [
      {
        id: 'user1',
        username: 'testuser',
        password: hashedPassword
      }
    ]
    await fs.writeFile(usersFile, JSON.stringify(defaultUsers, null, 2))
  }

  const codesFile = path.join(dataDir, 'codes.json')
  try {
    await fs.access(codesFile)
  } catch {
    await fs.writeFile(codesFile, JSON.stringify([], null, 2))
  }
}

async function readJson (filename) {
  const filePath = path.join(dataDir, filename)
  const data = await fs.readFile(filePath, 'utf8')
  return JSON.parse(data)
}

async function writeJson (filename, data) {
  const filePath = path.join(dataDir, filename)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

async function getClients () {
  return await readJson('clients.json')
}

async function getClient (clientId) {
  const clients = await getClients()
  return clients.find(c => c.client_id === clientId)
}

async function addClient (client) {
  const clients = await getClients()
  clients.push(client)
  await writeJson('clients.json', clients)
  return client
}

async function getUsers () {
  return await readJson('users.json')
}

async function getUser (username) {
  const users = await getUsers()
  return users.find(u => u.username === username)
}

async function getUserById (id) {
  const users = await getUsers()
  return users.find(u => u.id === id)
}

async function getUserByEmail (email) {
  const users = await getUsers()
  return users.find(u => u.email === email)
}

async function addUser (user) {
  const users = await getUsers()
  users.push(user)
  await writeJson('users.json', users)
  return user
}

async function updateUser (id, updates) {
  const users = await getUsers()
  const userIndex = users.findIndex(u => u.id === id)
  if (userIndex === -1) {
    throw new Error('User not found')
  }
  users[userIndex] = { ...users[userIndex], ...updates }
  await writeJson('users.json', users)
  return users[userIndex]
}

async function deleteUser (id) {
  const users = await getUsers()
  const filtered = users.filter(u => u.id !== id)
  await writeJson('users.json', filtered)
}

async function recordFailedLogin (userId) {
  const users = await getUsers()
  const userIndex = users.findIndex(u => u.id === userId)
  if (userIndex === -1) {
    return
  }

  const user = users[userIndex]
  const now = Date.now()
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
  const MAX_FAILED_ATTEMPTS = 5

  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1
  user.lastFailedLogin = now

  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockedUntil = now + LOCKOUT_DURATION_MS
  }

  users[userIndex] = user
  await writeJson('users.json', users)
}

async function clearFailedLoginAttempts (userId) {
  const users = await getUsers()
  const userIndex = users.findIndex(u => u.id === userId)
  if (userIndex === -1) {
    return
  }

  users[userIndex].failedLoginAttempts = 0
  users[userIndex].lastFailedLogin = null

  await writeJson('users.json', users)
}

async function getCodes () {
  return await readJson('codes.json')
}

async function addCode (code) {
  const codes = await getCodes()
  codes.push(code)
  await writeJson('codes.json', codes)
}

async function getCode (codeValue) {
  const codes = await getCodes()
  return codes.find(c => c.code === codeValue)
}

async function deleteCode (codeValue) {
  const codes = await getCodes()
  const filtered = codes.filter(c => c.code !== codeValue)
  await writeJson('codes.json', filtered)
}

// Cleanup expired codes
async function cleanupExpiredCodes () {
  const codes = await getCodes()
  const now = Date.now()
  const valid = codes.filter(c => c.expiresAt > now)
  await writeJson('codes.json', valid)
}

module.exports = {
  initDb,
  getClients,
  getClient,
  addClient,
  getUsers,
  getUser,
  getUserById,
  getUserByEmail,
  addUser,
  updateUser,
  deleteUser,
  recordFailedLogin,
  clearFailedLoginAttempts,
  getCodes,
  addCode,
  getCode,
  deleteCode,
  cleanupExpiredCodes
}
