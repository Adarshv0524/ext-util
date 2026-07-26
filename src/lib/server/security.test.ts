import { describe, it, expect } from 'vitest';
import {
	generateUploadToken,
	verifyUploadToken,
	safeEqual,
	checkMagicBytes
} from './security';
import { ASSET_SIZE_LIMITS, ALLOWED_MIME_TYPES } from '$lib/constants';

describe('Security Engine & HMAC Validation', () => {
	it('should generate deterministic HMAC tokens and verify them successfully', async () => {
		const key = 'uploads/user_avatar/42_12345678_abcd.webp';
		const userId = '42';
		const mime = 'image/webp';
		const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 min TTL
		const secret = 'test-hmac-secret-12345';

		const token = await generateUploadToken(key, userId, mime, expiresAt, secret);
		expect(token).toBeTypeOf('string');
		expect(token.length).toBe(64); // SHA-256 hex string

		const isValid = await verifyUploadToken(key, userId, mime, expiresAt, token, secret);
		expect(isValid).toBe(true);
	});

	it('should reject forged or tampered tokens', async () => {
		const key = 'uploads/user_avatar/42_12345678_abcd.webp';
		const userId = '42';
		const mime = 'image/webp';
		const expiresAt = Math.floor(Date.now() / 1000) + 300;
		const secret = 'test-hmac-secret-12345';

		const token = await generateUploadToken(key, userId, mime, expiresAt, secret);

		// Tamper with userId or object key
		const isUserValid = await verifyUploadToken(key, '999', mime, expiresAt, token, secret);
		expect(isUserValid).toBe(false);

		const isKeyValid = await verifyUploadToken('uploads/forged.png', userId, mime, expiresAt, token, secret);
		expect(isKeyValid).toBe(false);
	});

	it('should reject expired tokens', async () => {
		const key = 'uploads/user_avatar/42_expired.webp';
		const userId = '42';
		const mime = 'image/webp';
		const expiresAt = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago
		const secret = 'test-hmac-secret';

		const token = await generateUploadToken(key, userId, mime, expiresAt, secret);
		const isValid = await verifyUploadToken(key, userId, mime, expiresAt, token, secret);
		expect(isValid).toBe(false);
	});

	it('should perform timing-safe string comparison via safeEqual', () => {
		expect(safeEqual('abc123def', 'abc123def')).toBe(true);
		expect(safeEqual('abc123def', 'abc123xyz')).toBe(false);
		expect(safeEqual('abc', 'abcd')).toBe(false);
	});
});

describe('Magic Byte Binary Inspection', () => {
	it('should correctly identify JPEG magic bytes (FF D8 FF)', () => {
		const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
		expect(checkMagicBytes(jpegHeader, 'image/jpeg')).toBe(true);
		expect(checkMagicBytes(jpegHeader, 'image/png')).toBe(false);
	});

	it('should correctly identify PNG magic bytes (89 50 4E 47)', () => {
		const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
		expect(checkMagicBytes(pngHeader, 'image/png')).toBe(true);
		expect(checkMagicBytes(pngHeader, 'image/jpeg')).toBe(false);
	});

	it('should correctly identify WebP magic bytes (RIFF ... WEBP)', () => {
		const webpHeader = new Uint8Array([
			0x52, 0x49, 0x46, 0x46, // RIFF
			0x00, 0x00, 0x00, 0x00, // length
			0x57, 0x45, 0x42, 0x50  // WEBP
		]);
		expect(checkMagicBytes(webpHeader, 'image/webp')).toBe(true);
		expect(checkMagicBytes(webpHeader, 'image/png')).toBe(false);
	});

	it('should correctly identify GIF magic bytes (GIF8)', () => {
		const gifHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
		expect(checkMagicBytes(gifHeader, 'image/gif')).toBe(true);
	});

	it('should reject malicious executable (.exe) headers disguised as image/jpeg', () => {
		const fakeExeHeader = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // MZ
		expect(checkMagicBytes(fakeExeHeader, 'image/jpeg')).toBe(false);
		expect(checkMagicBytes(fakeExeHeader, 'image/png')).toBe(false);
		expect(checkMagicBytes(fakeExeHeader, 'image/webp')).toBe(false);
	});
});

describe('Asset Size Caps & Allowed MIME Types', () => {
	it('should define correct size caps per asset type', () => {
		expect(ASSET_SIZE_LIMITS['user_avatar']).toBe(2 * 1024 * 1024);
		expect(ASSET_SIZE_LIMITS['author_thumbnail']).toBe(2 * 1024 * 1024);
		expect(ASSET_SIZE_LIMITS['article_inline']).toBe(5 * 1024 * 1024);
		expect(ASSET_SIZE_LIMITS['author_cover']).toBe(10 * 1024 * 1024);
		expect(ASSET_SIZE_LIMITS['work_cover']).toBe(10 * 1024 * 1024);
	});

	it('should enforce strict allowed MIME whitelist', () => {
		expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
		expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
		expect(ALLOWED_MIME_TYPES.has('image/webp')).toBe(true);
		expect(ALLOWED_MIME_TYPES.has('image/gif')).toBe(true);
		expect(ALLOWED_MIME_TYPES.has('image/avif')).toBe(true);
		expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(false);
		expect(ALLOWED_MIME_TYPES.has('application/x-executable')).toBe(false);
	});
});
