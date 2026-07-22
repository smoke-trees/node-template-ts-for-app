import { createRemoteJWKSet, jwtVerify } from 'jose'
import { log } from '@smoke-trees/postgres-backend'
import settings from '../settings'

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_ISSUER = 'https://appleid.apple.com'

// Cache the JWKS remote key set so we're not re-fetching on every request
const AppleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL))

export interface AppleTokenPayload {
	sub: string
	email?: string
	email_verified?: boolean | string
	iss: string
	aud: string | string[]
	iat: number
	exp: number
}

/**
 * Verifies an Apple ID token against Apple's public JWKS.
 *
 * - Fetches Apple's public keys from https://appleid.apple.com/auth/keys (cached via createRemoteJWKSet)
 * - Verifies the JWT signature, issuer, and expiry
 * - Validates the audience against settings.appleLoginCreds.appBundleId (APPLE_APP_BUNDLE_ID env var)
 *   if configured; skips audience check when not set
 *
 * @throws Will NOT throw — returns null on any verification failure
 */
export async function verifyAppleIdToken(idToken: string): Promise<AppleTokenPayload | null> {
	try {
		const options: Parameters<typeof jwtVerify>[2] = {
			issuer: APPLE_ISSUER,
			algorithms: ['RS256']
		}

		const appBundleId = settings.appleLoginCreds.appBundleId
		if (appBundleId) {
			options.audience = appBundleId
		}

		const { payload } = await jwtVerify(idToken, AppleJWKS, options)

		if (!payload.sub) {
			log.warn('Apple token missing sub claim', 'verifyAppleIdToken', {})
			return null
		}

		return payload as unknown as AppleTokenPayload
	} catch (error) {
		log.warn('Apple ID token verification failed', 'verifyAppleIdToken', { error })
		return null
	}
}
