// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { User, Session } from '$lib/server/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: User | null;
			session: Session | null;
		}
		interface PageData {}
		interface PageState {}
		interface Platform {
			env?: {
				R2_BUCKET?: R2Bucket;
				TOKEN_KV?: KVNamespace;
				MEDIA_DB?: D1Database;
				HMAC_SECRET?: string;
				CDN_BASE_URL?: string;
			};
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches?: CacheStorage;
		}
	}
}

export {};
