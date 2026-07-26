/**
 * Client API for `ext-util` Image Microservice.
 * This file can be used by the parent application to directly upload images
 * without needing an iframe, or it can be used internally by the Upload Card.
 */

export interface UploadOptions {
	file: File;
	userId?: number;
	assetType?: string;
	apiBaseUrl?: string; // e.g. "https://ext-util.example.com"
}

export interface UploadResult {
	object_key: string;
	cdn_url: string;
	error?: string;
}

/**
 * Uploads a file directly to the Cloudflare R2 bucket via the ext-util API.
 * Phase 1: Request Upload Token
 * Phase 2: Stream Binary to Edge
 */
export async function uploadToExtUtil(options: UploadOptions): Promise<UploadResult> {
	const { file, userId = 1, assetType = 'article_inline', apiBaseUrl = '' } = options;

	try {
		// Phase 1: Request Token
		const tokenRes = await fetch(`${apiBaseUrl}/api/v1/media/upload-token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				asset_type: assetType,
				mime_type: file.type,
				file_size_bytes: file.size,
				file_name: file.name,
				uploader_user_id: userId
			})
		});

		if (!tokenRes.ok) {
			const err = await tokenRes.json().catch(() => ({}));
			throw new Error(err.error || `Token request failed with status ${tokenRes.status}`);
		}

		const tokenData = await tokenRes.json();
		const uploadUrl = tokenData.upload_url;
		const fullUploadUrl = apiBaseUrl ? `${apiBaseUrl}${uploadUrl}` : uploadUrl;

		// Phase 2: Upload Binary
		const uploadRes = await fetch(fullUploadUrl, {
			method: 'PUT',
			headers: {
				'Content-Type': file.type,
				'Content-Length': file.size.toString()
			},
			body: file // stream directly
		});

		if (!uploadRes.ok) {
			const err = await uploadRes.json().catch(() => ({}));
			throw new Error(err.error || `Binary upload failed with status ${uploadRes.status}`);
		}

		const uploadData = await uploadRes.json();
		return {
			object_key: uploadData.object_key,
			cdn_url: uploadData.cdn_url
		};
	} catch (error: any) {
		console.error('ext-util Upload Error:', error);
		return {
			object_key: '',
			cdn_url: '',
			error: error.message
		};
	}
}

/**
 * Phase 3: Commits an asset to mark it as permanently used (prevents orphan cleanup).
 */
export async function commitExtUtilAsset(
	objectKey: string,
	entityType: string,
	entityId: number,
	userId: number = 1,
	apiBaseUrl: string = ''
) {
	const res = await fetch(`${apiBaseUrl}/api/v1/media/commit`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			object_key: objectKey,
			associated_entity_type: entityType,
			associated_entity_id: entityId,
			user_id: userId
		})
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || 'Commit failed');
	}
	return await res.json();
}
