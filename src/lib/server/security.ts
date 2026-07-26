/**
 * Security Engine for imgapi Image Microservice.
 * Uses 100% Web Crypto API for zero external dependency HMAC signing,
 * timing-safe string comparison, and magic-byte binary MIME inspection.
 */

import { ENV_DEFAULTS } from '$lib/constants';

/**
 * Timing-safe string comparison to prevent timing side-channel attacks.
 * 
 * @param a The first string (usually the generated signature)
 * @param b The second string (usually the provided signature)
 * @returns true if the strings match exactly, without leaking length/match timing.
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
 * Payload format: `{objectKey}:{userId}:{mimeType}:{expiresAt}`
 * 
 * @param objectKey The deterministic Cloudflare R2 key for the file (e.g. `uploads/user_avatar/123_abc.png`)
 * @param userId The ID of the user uploading the file
 * @param mimeType The exact MIME type requested (e.g. `image/png`)
 * @param expiresAt The Unix timestamp (in seconds) when this token should expire
 * @param secret The secret HMAC key used to sign the token (from environment variables)
 * @returns A hexadecimal string representing the HMAC-SHA256 signature
 */
export async function generateUploadToken(
	objectKey: string,
	userId: string,
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
 * Verifies an HMAC-SHA256 signature token and checks its Time-To-Live (TTL).
 * 
 * @param objectKey The R2 key provided in the request
 * @param userId The ID of the user making the upload
 * @param mimeType The MIME type of the binary stream being uploaded
 * @param expiresAt The Unix timestamp when the token expires
 * @param signature The signature provided by the client
 * @param secret The server's HMAC secret key
 * @returns true if the signature is valid and has not expired, false otherwise.
 */
export async function verifyUploadToken(
	objectKey: string,
	userId: string,
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
 * Reads the first few bytes of a file buffer to guarantee its actual format,
 * preventing users from uploading malicious executables renamed to `.png`.
 * 
 * @param buffer The incoming raw binary stream (Uint8Array)
 * @param mimeType The expected MIME type claimed by the client
 * @returns true if the file's internal magic bytes match the claimed MIME type.
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
