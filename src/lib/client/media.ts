export interface UploadTokenResponse {
	upload_url: string;
	object_key: string;
	cdn_url: string;
	expires_at: string;
}

export interface CommitAssetResponse {
	object_key: string;
	cdn_url: string;
	is_committed: boolean;
	committed_at: string;
}

/**
 * Phase 1: Request presigned upload token from imgapi backend.
 */
export async function requestUploadToken(params: {
	asset_type:
		| 'user_avatar'
		| 'user_cover'
		| 'author_portrait'
		| 'author_cover'
		| 'author_thumbnail'
		| 'work_cover'
		| 'article_inline'
		| 'collection_cover';
	mime_type: string;
	file_size_bytes: number;
	file_name: string;
	uploader_user_id?: number;
}): Promise<UploadTokenResponse> {
	const res = await fetch('/api/v1/media/upload-token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(params)
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: 'Upload token request failed' }));
		throw new Error(err.error || `HTTP ${res.status}: Upload token request failed`);
	}

	return res.json();
}

/**
 * Phase 2: Stream binary file directly to R2 edge endpoint using upload_url.
 * Bypasses application server RAM entirely.
 */
export async function uploadToR2(uploadUrl: string, file: File): Promise<{ object_key: string; cdn_url: string; bytes_written?: number }> {
	const res = await fetch(uploadUrl, {
		method: 'PUT',
		headers: {
			'Content-Type': file.type,
			'Content-Length': file.size.toString()
		},
		body: file
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: 'Binary R2 upload failed' }));
		throw new Error(err.error || `HTTP ${res.status}: Direct R2 upload failed`);
	}

	return res.json();
}

/**
 * Phase 3: Commit asset metadata and link to entity.
 * Note: Skipped for inline Tiptap article images.
 */
export async function commitAsset(params: {
	object_key: string;
	associated_entity_type?: string;
	associated_entity_id?: number;
}): Promise<CommitAssetResponse> {
	const res = await fetch('/api/v1/media/commit', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(params)
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: 'Asset commit failed' }));
		throw new Error(err.error || `HTTP ${res.status}: Asset commit failed`);
	}

	return res.json();
}

/**
 * End-to-end client wrapper function for image uploads.
 */
export async function uploadImage(
	file: File,
	assetType:
		| 'user_avatar'
		| 'user_cover'
		| 'author_portrait'
		| 'author_cover'
		| 'author_thumbnail'
		| 'work_cover'
		| 'article_inline'
		| 'collection_cover',
	options?: {
		commit?: boolean;
		entityType?: string;
		entityId?: number;
		uploaderUserId?: number;
	}
): Promise<{ cdn_url: string; object_key: string }> {
	// Phase 1: Request token
	const tokenResp = await requestUploadToken({
		asset_type: assetType,
		mime_type: file.type,
		file_size_bytes: file.size,
		file_name: file.name,
		uploader_user_id: options?.uploaderUserId
	});

	// Phase 2: Direct stream upload to R2 edge
	await uploadToR2(tokenResp.upload_url, file);

	// Phase 3: Commit asset (if requested & not article_inline)
	if (options?.commit && assetType !== 'article_inline') {
		await commitAsset({
			object_key: tokenResp.object_key,
			associated_entity_type: options.entityType,
			associated_entity_id: options.entityId
		});
	}

	return {
		cdn_url: tokenResp.cdn_url,
		object_key: tokenResp.object_key
	};
}
