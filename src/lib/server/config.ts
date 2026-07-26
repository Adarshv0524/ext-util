import { ENV_DEFAULTS } from '$lib/constants';

/**
 * Helper for extracting Environment Variables and Cloudflare Bindings safely.
 * 
 * In Cloudflare Workers (and SvelteKit on Cloudflare), environment variables 
 * and resource bindings (like R2, D1, KV) are NOT available on `process.env`.
 * Instead, they are injected per-request into `platform.env`.
 * 
 * This function standardizes the extraction of these bindings, falling back 
 * to default constants if the bindings are not provided (useful for local dev).
 * 
 * @param platformEnv The environment bindings injected by Cloudflare into the request.
 * @returns A strictly typed object containing all required secrets and Cloudflare resources.
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
