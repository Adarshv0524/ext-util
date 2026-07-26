/**
 * Unified Configuration & Settings for ext-util Image Microservice.
 * 
 * Centralizes all constants, limits, and environment variable fallbacks.
 * In Cloudflare Workers/SvelteKit, actual env vars are injected per-request 
 * via `platform.env`. This file provides the typed structure and defaults.
 */

// ==========================================
// 1. Core Settings & Timeouts
// ==========================================
export const CORE_SETTINGS = {
	TOKEN_TTL_SECONDS: 300, // 5 minutes TTL for Phase 1 Upload Token
	DB_LEDGER_TTL_SECONDS: 420, // 7 minutes TTL for Uncommitted DB Assets (Allows time for streaming)
};

// ==========================================
// 2. Default Environment Variables
// ==========================================
// These are fallbacks if `platform.env` bindings are not set.
// Production should ALWAYS use Wrangler secrets or env vars.
export const ENV_DEFAULTS = {
	HMAC_SECRET: 'ext-util-secret-key-change-in-prod',
	CDN_BASE_URL: 'http://localhost:5173',
};

// ==========================================
// 3. Security Limits & Validation
// ==========================================
export const ALLOWED_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif'
]);

export const ASSET_SIZE_LIMITS: Record<string, number> = {
	user_avatar: 2 * 1024 * 1024, // 2 MB
	author_thumbnail: 2 * 1024 * 1024, // 2 MB
	article_inline: 5 * 1024 * 1024, // 5 MB
	author_portrait: 5 * 1024 * 1024, // 5 MB
	author_cover: 10 * 1024 * 1024, // 10 MB
	work_cover: 10 * 1024 * 1024, // 10 MB
	user_cover: 10 * 1024 * 1024, // 10 MB
	collection_cover: 10 * 1024 * 1024 // 10 MB
};

// ==========================================
// 4. Helper for extracting Env safely
// ==========================================
/**
 * Merges the request-scoped Cloudflare platform.env with default constants.
 */
export function getEnv(platformEnv?: App.Platform['env']) {
	return {
		HMAC_SECRET: platformEnv?.HMAC_SECRET || ENV_DEFAULTS.HMAC_SECRET,
		CDN_BASE_URL: platformEnv?.CDN_BASE_URL || ENV_DEFAULTS.CDN_BASE_URL,
		R2_BUCKET: platformEnv?.R2_BUCKET,
		TOKEN_KV: platformEnv?.TOKEN_KV,
		MEDIA_DB: platformEnv?.MEDIA_DB,
	};
}
