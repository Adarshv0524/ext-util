/**
 * Shared Constants for ext-util Image Microservice.
 * 
 * Centralizes all constants and limits used by both client and server.
 * Changing values here will automatically reflect in the frontend documentation
 * and enforce the new limits on the backend Edge workers.
 */

// ==========================================
// 1. Core Settings & Timeouts
// ==========================================

/**
 * Core Operational Settings.
 * Defines the Time-To-Live (TTL) for secure upload tokens and database ledger entries.
 */
export const CORE_SETTINGS = {
	/**
	 * How long (in seconds) the Phase 1 signed token remains valid. 
	 * The client must complete the binary stream to R2 within this window.
	 * Default: 300 (5 minutes)
	 */
	TOKEN_TTL_SECONDS: 300, 
	
	/**
	 * How long (in seconds) an uncommitted asset remains in the database 
	 * before it is considered an orphan and picked up by the cleanup Cron job.
	 * Must be slightly longer than TOKEN_TTL_SECONDS to account for upload time.
	 * Default: 420 (7 minutes)
	 */
	DB_LEDGER_TTL_SECONDS: 420, 
};

// ==========================================
// 2. Default Environment Variables
// ==========================================

/**
 * Fallback Environment Defaults.
 * These are used strictly if the environment bindings (via .env or Wrangler) are missing.
 */
export const ENV_DEFAULTS = {
	/** Default fallback HMAC key. MUST BE OVERRIDDEN IN PRODUCTION. */
	HMAC_SECRET: 'ext-util-secret-key-change-in-prod',
	
	/** The default domain used to construct public image URLs. */
	CDN_BASE_URL: 'https://util.avadhya.in',
};

// ==========================================
// 3. Security Limits & Validation
// ==========================================

/**
 * Whitelist of explicitly allowed MIME types for uploaded files.
 * The system will reject any file that does not match this list both by 
 * string comparison and Magic Byte binary validation.
 */
export const ALLOWED_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/avif'
]);

/**
 * Maximum file size limits (in bytes) strictly enforced per asset type.
 * When the client requests an upload token, the requested `asset_type` 
 * is cross-referenced here to ensure the file is within allowed constraints.
 */
export const ASSET_SIZE_LIMITS: Record<string, number> = {
	/** Standard user profile picture (2 MB) */
	user_avatar: 2 * 1024 * 1024,
	
	/** Small thumbnail for an author (2 MB) */
	author_thumbnail: 2 * 1024 * 1024,
	
	/** Large image embedded inside a Tiptap article (5 MB) */
	article_inline: 5 * 1024 * 1024,
	
	/** High-res portrait for an author (5 MB) */
	author_portrait: 5 * 1024 * 1024,
	
	/** Wide banner image for an author page (10 MB) */
	author_cover: 10 * 1024 * 1024,
	
	/** Cover image for a specific work/book (10 MB) */
	work_cover: 10 * 1024 * 1024,
	
	/** Wide banner image for a user profile (10 MB) */
	user_cover: 10 * 1024 * 1024,
	
	/** Cover image for a collection of works (10 MB) */
	collection_cover: 10 * 1024 * 1024
};
