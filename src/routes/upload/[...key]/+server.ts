import { json, type RequestHandler } from '@sveltejs/kit';
import { checkMagicBytes, verifyUploadToken } from '$lib/server/security';
import { ASSET_SIZE_LIMITS, getEnv, CORE_SETTINGS } from '$lib/server/config';

// In-memory binary storage fallback when R2 bucket binding is not present (e.g. local test mode)
const localR2Mock = new Map<string, { body: Uint8Array; mime: string }>();

export const PUT: RequestHandler = async ({ params, url, request, platform }) => {
	try {
		const objectKey = params.key;
		if (!objectKey) {
			return json({ error: 'Missing object key' }, { status: 400 });
		}

		// 1. Extract query params & headers
		const userIdStr = url.searchParams.get('user_id') || '1';
		const userId = parseInt(userIdStr, 10);
		const mimeType = url.searchParams.get('mime') || request.headers.get('content-type') || '';
		const expiresStr = url.searchParams.get('expires') || '0';
		const expiresAt = parseInt(expiresStr, 10);
		const token = url.searchParams.get('token') || request.headers.get('x-upload-token') || '';

		// 2. Validate HMAC signature & expiration
		const env = getEnv(platform?.env);
		const secret = env.HMAC_SECRET;
		const isValidToken = await verifyUploadToken(
			objectKey,
			userId,
			mimeType,
			expiresAt,
			token,
			secret
		);

		if (!isValidToken) {
			return json(
				{ error: 'Invalid, forged, or expired upload token.' },
				{ status: 401 }
			);
		}

		// 3. One-Time-Use KV check
		if (env.TOKEN_KV) {
			const kvKey = `otpu:${objectKey}`;
			const existingState = await env.TOKEN_KV.get(kvKey);

			if (existingState === 'used') {
				return json(
					{ error: 'Upload token has already been consumed (one-time-use).' },
					{ status: 409 }
				);
			}
			if (existingState === null) {
				return json(
					{ error: 'Upload token not recognized or expired.' },
					{ status: 403 }
				);
			}

			// Mark as consumed
			await env.TOKEN_KV.put(kvKey, 'used', { expirationTtl: CORE_SETTINGS.TOKEN_TTL_SECONDS });
		}

		// 4. Content-Length & Size Cap check
		const contentLengthHeader = request.headers.get('content-length');
		const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
		
		// Infer asset_type from key path (e.g., uploads/user_avatar/...)
		const keyParts = objectKey.split('/');
		const assetType = keyParts.length > 1 ? keyParts[1] : 'article_inline';
		const maxAllowedSize = ASSET_SIZE_LIMITS[assetType] || 5 * 1024 * 1024;

		if (contentLength > maxAllowedSize) {
			return json(
				{
					error: `Payload too large: Content-Length ${contentLength} exceeds ${maxAllowedSize} bytes limit.`
				},
				{ status: 413 }
			);
		}

		// 5. Binary Stream & Magic-Byte MIME Validation
		const arrayBuffer = await request.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);

		if (uint8Array.length > maxAllowedSize) {
			return json(
				{
					error: `Payload too large: Received ${uint8Array.length} bytes exceeding limit of ${maxAllowedSize} bytes.`
				},
				{ status: 413 }
			);
		}

		// Magic byte inspection
		const isMagicByteValid = checkMagicBytes(uint8Array, mimeType);
		if (!isMagicByteValid) {
			return json(
				{
					error: `Magic byte inspection failed. File content does not match declared MIME type '${mimeType}'.`
				},
				{ status: 415 }
			);
		}

		// 6. Direct binary upload to Cloudflare R2 bucket or local mock
		let bytesWritten = uint8Array.length;
		if (env.R2_BUCKET) {
			await env.R2_BUCKET.put(objectKey, arrayBuffer, {
				httpMetadata: { contentType: mimeType }
			});
		} else {
			// Local development fallback
			localR2Mock.set(objectKey, { body: uint8Array, mime: mimeType });
		}

		const cdnBase = env.CDN_BASE_URL;
		return json({
			object_key: objectKey,
			bytes_written: bytesWritten,
			cdn_url: `${cdnBase}/upload/${objectKey}`
		});
	} catch (err: any) {
		return json({ error: err.message || 'Upload failed' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ params, platform }) => {
	const objectKey = params.key;
	if (!objectKey) return new Response('Not Found', { status: 404 });

	const env = getEnv(platform?.env);
	if (env.R2_BUCKET) {
		const object = await env.R2_BUCKET.get(objectKey);
		if (!object) return new Response('Asset Not Found', { status: 404 });

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);
		headers.set('cache-control', 'public, max-age=31536000, immutable');

		return new Response(object.body, { headers });
	}

	// Local fallback
	const mockData = localR2Mock.get(objectKey);
	if (mockData) {
		return new Response(mockData.body.buffer as ArrayBuffer, {
			headers: {
				'content-type': mockData.mime,
				'cache-control': 'public, max-age=31536000, immutable'
			}
		});
	}

	return new Response('Asset Not Found', { status: 404 });
};
