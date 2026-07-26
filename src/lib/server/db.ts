export interface MediaAssetRecord {
	id: string;
	uploader_user_id: number;
	r2_object_key: string;
	public_url: string;
	asset_type:
		| 'user_avatar'
		| 'user_cover'
		| 'author_portrait'
		| 'author_cover'
		| 'author_thumbnail'
		| 'work_cover'
		| 'article_inline'
		| 'collection_cover';
	associated_entity_type?: string | null;
	associated_entity_id?: number | null;
	is_committed: boolean;
	uploaded_at: string;
	committed_at?: string | null;
	expires_at?: string | null;
}

// In-memory store fallback for local development or testing when Cloudflare bindings are absent
const localInMemoryStore = new Map<string, MediaAssetRecord>();

/**
 * Creates an uncommitted asset record in KV/D1 or in-memory fallback.
 */
export async function createUncommittedAsset(
	env: App.Platform['env'] | undefined,
	asset: {
		uploader_user_id: number;
		r2_object_key: string;
		public_url: string;
		asset_type: MediaAssetRecord['asset_type'];
		expires_at: string;
	}
): Promise<MediaAssetRecord> {
	const record: MediaAssetRecord = {
		id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		uploader_user_id: asset.uploader_user_id,
		r2_object_key: asset.r2_object_key,
		public_url: asset.public_url,
		asset_type: asset.asset_type,
		associated_entity_type: null,
		associated_entity_id: null,
		is_committed: false,
		uploaded_at: new Date().toISOString(),
		committed_at: null,
		expires_at: asset.expires_at
	};

	if (env?.MEDIA_DB) {
		// Cloudflare D1 query
		await env.MEDIA_DB.prepare(
			`INSERT INTO media_assets (id, uploader_user_id, r2_object_key, public_url, asset_type, is_committed, uploaded_at, expires_at)
			 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
		)
			.bind(
				record.id,
				record.uploader_user_id,
				record.r2_object_key,
				record.public_url,
				record.asset_type,
				record.uploaded_at,
				record.expires_at
			)
			.run();
	} else if (env?.TOKEN_KV) {
		// Cloudflare KV metadata store
		const metaKey = `asset:${record.r2_object_key}`;
		await env.TOKEN_KV.put(metaKey, JSON.stringify(record), {
			// Set KV TTL to 7 days or matching expiry window
			expirationTtl: 604800
		});
	}

	// Always update local memory store for instant lookup/fallback
	localInMemoryStore.set(record.r2_object_key, record);

	return record;
}

/**
 * Gets an asset record by its R2 object key.
 */
export async function getAssetByKey(
	env: App.Platform['env'] | undefined,
	r2ObjectKey: string
): Promise<MediaAssetRecord | null> {
	if (env?.MEDIA_DB) {
		const res = await env.MEDIA_DB.prepare(
			`SELECT * FROM media_assets WHERE r2_object_key = ?`
		)
			.bind(r2ObjectKey)
			.first<MediaAssetRecord>();
		if (res) return res;
	} else if (env?.TOKEN_KV) {
		const val = await env.TOKEN_KV.get(`asset:${r2ObjectKey}`);
		if (val) return JSON.parse(val) as MediaAssetRecord;
	}

	return localInMemoryStore.get(r2ObjectKey) || null;
}

/**
 * Flips asset.is_committed to true and sets entity metadata.
 */
export async function commitAssetRecord(
	env: App.Platform['env'] | undefined,
	r2ObjectKey: string,
	entityType?: string,
	entityId?: number
): Promise<MediaAssetRecord | null> {
	const record = await getAssetByKey(env, r2ObjectKey);
	if (!record) return null;

	const nowIso = new Date().toISOString();
	record.is_committed = true;
	record.committed_at = nowIso;
	record.expires_at = null;
	if (entityType) record.associated_entity_type = entityType;
	if (entityId !== undefined) record.associated_entity_id = entityId;

	if (env?.MEDIA_DB) {
		await env.MEDIA_DB.prepare(
			`UPDATE media_assets 
			 SET is_committed = 1, committed_at = ?, expires_at = NULL, associated_entity_type = ?, associated_entity_id = ?
			 WHERE r2_object_key = ?`
		)
			.bind(
				nowIso,
				entityType || null,
				entityId ?? null,
				r2ObjectKey
			)
			.run();
	} else if (env?.TOKEN_KV) {
		await env.TOKEN_KV.put(`asset:${r2ObjectKey}`, JSON.stringify(record));
	}

	localInMemoryStore.set(r2ObjectKey, record);
	return record;
}

/**
 * Removes or purges an asset record.
 */
export async function deleteAssetRecord(
	env: App.Platform['env'] | undefined,
	r2ObjectKey: string
): Promise<boolean> {
	let deleted = false;
	if (env?.MEDIA_DB) {
		await env.MEDIA_DB.prepare(`DELETE FROM media_assets WHERE r2_object_key = ?`)
			.bind(r2ObjectKey)
			.run();
		deleted = true;
	}
	if (env?.TOKEN_KV) {
		await env.TOKEN_KV.delete(`asset:${r2ObjectKey}`);
		deleted = true;
	}

	if (localInMemoryStore.has(r2ObjectKey)) {
		localInMemoryStore.delete(r2ObjectKey);
		deleted = true;
	}

	return deleted;
}

/**
 * Finds uncommitted assets where expires_at < NOW().
 */
export async function findExpiredUncommittedAssets(
	env: App.Platform['env'] | undefined
): Promise<MediaAssetRecord[]> {
	const nowIso = new Date().toISOString();

	if (env?.MEDIA_DB) {
		const res = await env.MEDIA_DB.prepare(
			`SELECT * FROM media_assets WHERE is_committed = 0 AND expires_at IS NOT NULL AND expires_at < ?`
		)
			.bind(nowIso)
			.all<MediaAssetRecord>();
		return res.results || [];
	}

	// KV / Local memory scan fallback
	const expired: MediaAssetRecord[] = [];
	for (const record of localInMemoryStore.values()) {
		if (!record.is_committed && record.expires_at && record.expires_at < nowIso) {
			expired.push(record);
		}
	}
	return expired;
}

/**
 * Finds abandoned inline article assets (> 24 hours old with no document commitment).
 */
export async function findAbandonedInlineAssets(
	env: App.Platform['env'] | undefined
): Promise<MediaAssetRecord[]> {
	const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

	if (env?.MEDIA_DB) {
		const res = await env.MEDIA_DB.prepare(
			`SELECT * FROM media_assets WHERE asset_type = 'article_inline' AND is_committed = 0 AND uploaded_at < ?`
		)
			.bind(cutoff)
			.all<MediaAssetRecord>();
		return res.results || [];
	}

	const abandoned: MediaAssetRecord[] = [];
	for (const record of localInMemoryStore.values()) {
		if (record.asset_type === 'article_inline' && !record.is_committed && record.uploaded_at < cutoff) {
			abandoned.push(record);
		}
	}
	return abandoned;
}
