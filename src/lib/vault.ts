import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALG = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    // Dev fallback — logs a warning; not safe for production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is required in production for the key vault')
    }
    console.warn('[vault] ENCRYPTION_KEY not set — using insecure dev fallback')
    return Buffer.concat([Buffer.from('apex-pulse-dev-insecure-fallback!!'), Buffer.alloc(0)]).slice(0, 32)
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length < 32) throw new Error('ENCRYPTION_KEY must decode to at least 32 bytes')
  return buf.slice(0, 32)
}

// Returns: `ivHex:authTagHex:ciphertextHex`
export function encrypt(plaintext: string): string {
  const key        = getKey()
  const iv         = randomBytes(12)
  const cipher     = createCipheriv(ALG, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag    = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decrypt(encrypted: string): string {
  const key    = getKey()
  const parts  = encrypted.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted payload')
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv         = Buffer.from(ivHex, 'hex')
  const authTag    = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher   = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

// Resolve key for a provider: vault (encrypted DB) → env fallback
export async function resolveProviderKey(provider: string, envKey: string): Promise<string | null> {
  try {
    const { prisma } = await import('@/lib/db')
    const cred = await prisma.providerCredential.findUnique({ where: { provider } })
    if (cred?.encryptedKey) return decrypt(cred.encryptedKey)
  } catch {}
  return envKey || null
}

// Shows first 4 + last 4 chars (e.g. "sk-a…4xyz")
export function maskKey(raw: string): string {
  if (raw.length <= 8) return '●●●●'
  return raw.slice(0, 4) + '●●●●' + raw.slice(-4)
}
