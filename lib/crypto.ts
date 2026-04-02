'use server'

const rawKey = process.env.TOKEN_ENCRYPTION_KEY

if (!rawKey) {
  throw new Error('TOKEN_ENCRYPTION_KEY is not set')
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

let cachedKey: Promise<CryptoKey> | null = null

async function getKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = (async () => {
      // Derive a 256-bit key from the env secret
      const keyMaterial = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(rawKey)
      )

      return crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      )
    })()
  }

  return cachedKey
}

export async function encryptToken(token: string): Promise<string> {
  const cryptoKey = await getKey()

  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(token)
  )

  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return Buffer.from(combined).toString('base64url')
}

export async function decryptToken(encrypted: string): Promise<string> {
  try {
    const cryptoKey = await getKey()

    const combined = Buffer.from(encrypted, 'base64url')

    const iv = combined.subarray(0, 12)
    const data = combined.subarray(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    )

    return decoder.decode(decrypted)
  } catch (err) {
    throw new Error('Invalid or corrupted token')
  }
}