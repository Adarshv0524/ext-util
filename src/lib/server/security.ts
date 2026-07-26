/**
 * Security Engine for ext-util Image Microservice.
 * Uses 100% Web Crypto API for zero external dependency HMAC signing,
 * timing-safe string comparison, and magic-byte binary MIME inspection.
 */

import { ENV_DEFAULTS } from './config';

/**
 * Timing-safe string comparison to prevent timing side-channel attacks.
 */
export function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

/**
 * Import a raw key string into a Web Crypto HMAC key.
 */
async function getHmacKey(secret: string): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret || ENV_DEFAULTS.HMAC_SECRET);
	return crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

/**
 * Generates an HMAC-SHA256 signature token for upload requests.
 * Payload format: {object_key}:{user_id}:{mime_type}:{expires_at}
 */
export async function generateUploadToken(
	objectKey: string,
	userId: number,
	mimeType: string,
	expiresAt: number,
	secret: string = ENV_DEFAULTS.HMAC_SECRET
): Promise<string> {
	const payload = `${objectKey}:${userId}:${mimeType}:${expiresAt}`;
	const key = await getHmacKey(secret);
	const encoder = new TextEncoder();
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	return Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Verifies an HMAC-SHA256 signature token and checks TTL.
 */
export async function verifyUploadToken(
	objectKey: string,
	userId: number,
	mimeType: string,
	expiresAt: number,
	signature: string,
	secret: string = ENV_DEFAULTS.HMAC_SECRET
): Promise<boolean> {
	const nowSeconds = Math.floor(Date.now() / 1000);
	if (nowSeconds > expiresAt) {
		return false; // Token expired
	}

	const expectedSignature = await generateUploadToken(
		objectKey,
		userId,
		mimeType,
		expiresAt,
		secret
	);
	return safeEqual(expectedSignature.toLowerCase(), signature.toLowerCase());
}

/**
 * Magic-byte inspection for binary file verification at the edge.
 * Returns true if the magic bytes of the Uint8Array buffer match the declared MIME type.
 */
export function checkMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
	if (!buffer || buffer.length < 4) return false;

	switch (mimeType) {
		case 'image/jpeg':
			// JPEG magic bytes: FF D8 FF
			return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

		case 'image/png':
			// PNG magic bytes: 89 50 4E 47 (.PNG)
			return (
				buffer[0] === 0x89 &&
				buffer[1] === 0x50 &&
				buffer[2] === 0x4e &&
				buffer[3] === 0x47
			);

		case 'image/webp':
			// WebP magic bytes: RIFF at 0..3 and WEBP at 8..11
			if (buffer.length < 12) return false;
			const isRiff =
				buffer[0] === 0x52 &&
				buffer[1] === 0x49 &&
				buffer[2] === 0x46 &&
				buffer[3] === 0x46;
			const isWebp =
				buffer[8] === 0x57 &&
				buffer[9] === 0x45 &&
				buffer[10] === 0x42 &&
				buffer[11] === 0x50;
			return isRiff && isWebp;

		case 'image/gif':
			// GIF magic bytes: GIF8 (47 49 46 38)
			return (
				buffer[0] === 0x47 &&
				buffer[1] === 0x49 &&
				buffer[2] === 0x46 &&
				buffer[3] === 0x38
			);

		case 'image/avif':
			// AVIF magic bytes: ftyp box at 4..7 (66 74 79 70) and brand at 8..11 (avif / avis / ma1b)
			if (buffer.length < 12) return false;
			const isFtyp =
				buffer[4] === 0x66 &&
				buffer[5] === 0x74 &&
				buffer[6] === 0x79 &&
				buffer[7] === 0x70;
			if (!isFtyp) return false;
			const brandStr = String.fromCharCode(
				buffer[8],
				buffer[9],
				buffer[10],
				buffer[11]
			);
			return ['avif', 'avis', 'mif1', 'msf1', 'ma1b', 'ma1p'].includes(brandStr);

		default:
			return false;
	}
}
