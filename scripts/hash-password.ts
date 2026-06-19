#!/usr/bin/env tsx
/**
 * Utility to create a bcrypt hash for a plaintext password.
 * Usage: npm run auth:hash-password
 * Then store the hash in the User table via `prisma studio` or a migration seed.
 */
import { hash } from 'bcryptjs'
import * as readline from 'readline'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('Enter password to hash: ', async (password) => {
  if (!password) {
    console.error('Password cannot be empty.')
    process.exit(1)
  }
  const hashed = await hash(password, 12)
  console.log('\nBcrypt hash (copy this into passwordHash field):')
  console.log(hashed)
  rl.close()
})
