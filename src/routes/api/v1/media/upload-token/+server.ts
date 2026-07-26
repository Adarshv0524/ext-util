import { json, type RequestHandler } from '@sveltejs/kit';
import { generateUploadToken } from '$lib/server/security';
import { getEnv } from '$lib/server/config';
import { ALLOWED_MIME_TYPES, ASSET_SIZE_LIMITS, CORE_SETTINGS } from '$lib/constants';
import { createUncommittedAsset } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	try {
		const body = await request.json();
		const {
			asset_type,
			mime_type,
			file_size_bytes,
			file_name,
			uploader_user_id,
			project_id
		} = body;

		// 1. Auth & Validation
		let userId = locals.user?.id;
		
		// If project_id is provided, we MUST validate it and derive the userId from it
		let projectRecord = null;
		
		if (project_id === 'demo') {
			userId = 'demo_user';
		} else if (project_id && typeof project_id === 'string' && platform?.env?.MEDIA_DB) {
			const db = platform.env.MEDIA_DB;
			projectRecord = await db.prepare("SELECT user_id, hmac_secret FROM projects WHERE id = ?").bind(project_id).first();
			if (!projectRecord) {
				return json({ error: 'Invalid project ID.' }, { status: 401 });
			}
			// If logged in, ensure ownership
			if (userId && projectRecord.user_id !== userId) {
				return json({ error: 'Unauthorized to upload to this project.' }, { status: 403 });
			}
			userId = projectRecord.user_id;
		}

		if (!userId) {
			return json({ error: 'Authentication required. Please provide a valid project_id or log in.' }, { status: 401 });
		}

		if (!asset_type || !ASSET_SIZE_LIMITS[asset_type]) {
			return json(
				{ error: 'Invalid or unsupported asset_type.' },
				{ status: 400 }
			);
		}

		// 2. MIME type validation
		if (!mime_type || !ALLOWED_MIME_TYPES.has(mime_type)) {
			return json(
				{
					error: `MIME type '${mime_type}' is not allowed. Allowed types: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`
				},
				{ status: 400 }
			);
		}

		// 3. File size cap validation
		const maxAllowed = ASSET_SIZE_LIMITS[asset_type];
		if (!file_size_bytes || file_size_bytes > maxAllowed) {
			return json(
				{
					error: `File size ${file_size_bytes || 0} bytes exceeds maximum limit of ${maxAllowed} bytes (${maxAllowed / (1024 * 1024)} MB) for ${asset_type}.`
				},
				{ status: 413 }
			);
		}

		// 4. Construct deterministic object key
		const extParts = (file_name || '').split('.');
		const ext = extParts.length > 1 ? extParts.pop()?.toLowerCase() : 'bin';
		const randomId = crypto.randomUUID().slice(0, 8);
		
		// Optional project organization
		let folderPath = '';
		if (project_id && typeof project_id === 'string') {
			// Sanitize: allow only alphanumeric and hyphens/underscores, max 32 chars
			const sanitized = project_id.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 32);
			if (sanitized) {
				folderPath = `${sanitized}/`;
			}
		}

		const objectKey = `uploads/${folderPath}${asset_type}/${userId}_${Date.now()}_${randomId}.${ext}`;

		// 5. Expiry calculation
		const nowSeconds = Math.floor(Date.now() / 1000);
		const expiresAtSeconds = nowSeconds + CORE_SETTINGS.TOKEN_TTL_SECONDS;
		const expiresAtIso = new Date(expiresAtSeconds * 1000).toISOString();
		const dbExpiresAtIso = new Date((nowSeconds + CORE_SETTINGS.DB_LEDGER_TTL_SECONDS) * 1000).toISOString();

		// 6. Config & Env
		const env = getEnv(platform?.env);

		// 6.5 Lookup project HMAC secret
		let hmacSecret = env.HMAC_SECRET;
		if (projectRecord && projectRecord.hmac_secret) {
			hmacSecret = projectRecord.hmac_secret as string;
		}

		if (!hmacSecret) {
			return json({ error: 'System configuration error: No HMAC secret available.' }, { status: 500 });
		}

		// 7. Sign HMAC token
		const token = await generateUploadToken(
			objectKey,
			userId,
			mime_type,
			expiresAtSeconds,
			hmacSecret
		);

		const cdnUrl = `${env.CDN_BASE_URL}/upload/${objectKey}`;
		const uploadUrl = `/upload/${objectKey}?user_id=${userId}&mime=${encodeURIComponent(mime_type)}&expires=${expiresAtSeconds}&token=${token}`;

		// 8. Store KV one-time-use flag ('pending')
		if (env.TOKEN_KV) {
			await env.TOKEN_KV.put(`otpu:${objectKey}`, 'pending', {
				expirationTtl: CORE_SETTINGS.TOKEN_TTL_SECONDS
			});
		}

		// 9. Create uncommitted asset record in DB ledger
		await createUncommittedAsset(platform?.env, {
			uploader_user_id: userId,
			r2_object_key: objectKey,
			public_url: cdnUrl,
			asset_type,
			expires_at: dbExpiresAtIso
		});

		return json({
			upload_url: uploadUrl,
			object_key: objectKey,
			cdn_url: cdnUrl,
			expires_at: expiresAtIso
		});
	} catch (err: any) {
		return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
	}
};
