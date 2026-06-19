// RFC 6238 (TOTP) / RFC 4226 (HOTP) — pure Node crypto, no external dependency.
// Used for self-service MFA (S13). Secrets are stored encrypted via vault.ts.

import { randomBytes, createHmac } from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const DIGITS = 6
const PERIOD_SECONDS = 30

function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter))

  const hmac   = createHmac('sha1', secret).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const otp = binCode % 10 ** digits
  return String(otp).padStart(digits, '0')
}

export function generateTotp(secretBase32: string, time = Date.now()): string {
  const counter = Math.floor(time / 1000 / PERIOD_SECONDS)
  return hotp(base32Decode(secretBase32), counter)
}

// Tolerates ±1 step of clock drift between server and authenticator app.
export function verifyTotp(secretBase32: string, token: string, window = 1, time = Date.now()): boolean {
  const clean = token.trim().replace(/\s+/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  for (let delta = -window; delta <= window; delta++) {
    if (generateTotp(secretBase32, time + delta * PERIOD_SECONDS * 1000) === clean) return true
  }
  return false
}

export function otpauthUrl(secretBase32: string, accountEmail: string, issuer = 'APEX Pulse'): string {
  const label = `${issuer}:${accountEmail}`
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(PERIOD_SECONDS) })
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}
