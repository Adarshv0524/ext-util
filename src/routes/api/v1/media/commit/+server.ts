import { json, type RequestHandler } from '@sveltejs/kit';
import { commitAssetRecord, getAssetByKey } from '$lib/server/db';
import { getEnv } from '$lib/server/config';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	try {
		const body = await request.json();
		const { object_key, associated_entity_type, associated_entity_id, user_id, uploader_user_id } = body;

		if (!object_key) {
			return json({ error: 'Missing object_key in request body.' }, { status: 400 });
		}

		// Determine user ID (check both naming conventions to be safe)
		const actorUserId = locals.user?.id || user_id || uploader_user_id || 1;

		// 1. Fetch asset record from lifecycle ledger
		const env = getEnv(platform?.env);
		const asset = await getAssetByKey(env, object_key);
		if (!asset) {
			return json({ error: 'Asset record not found.' }, { status: 404 });
		}

		// 2. Ownership verification
		if (asset.uploader_user_id !== actorUserId) {
			return json(
				{ error: 'Forbidden: Asset belongs to another user.' },
				{ status: 403 }
			);
		}

		// 3. Check if already committed
		if (asset.is_committed) {
			return json(
				{
					error: 'Asset is already committed.',
					cdn_url: asset.public_url,
					committed_at: asset.committed_at
				},
				{ status: 409 }
			);
		}

		// 4. Commit asset record in lifecycle ledger
		const updatedRecord = await commitAssetRecord(
			env,
			object_key,
			associated_entity_type,
			associated_entity_id
		);

		// 5. Fire webhook if configured
		try {
			const parts = object_key.split('/');
			if (parts.length >= 3 && parts[0] === 'uploads') {
				const projectSlug = parts[2];
				const project = await env.MEDIA_DB.prepare('SELECT webhook_url FROM projects WHERE project_slug = ? AND user_id = ?').bind(projectSlug, actorUserId).first();
				
				if (project && project.webhook_url) {
					const webhookPayload = {
						event: 'upload.committed',
						object_key: object_key,
						cdn_url: asset.public_url,
						committed_at: updatedRecord?.committed_at || new Date().toISOString(),
						associated_entity_type: updatedRecord?.associated_entity_type || null,
						associated_entity_id: updatedRecord?.associated_entity_id || null
					};
					
					// Fire and forget
					platform?.context?.waitUntil(
						fetch(project.webhook_url as string, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(webhookPayload)
						}).catch(e => console.error("Webhook failed:", e))
					);
				}
			}
		} catch (e) {
			console.error("Webhook processing error:", e);
		}

		return json({
			object_key: object_key,
			cdn_url: asset.public_url,
			is_committed: true,
			committed_at: updatedRecord?.committed_at || new Date().toISOString(),
			associated_entity_type: updatedRecord?.associated_entity_type || null,
			associated_entity_id: updatedRecord?.associated_entity_id || null
		});
	} catch (err: any) {
		return json({ error: err.message || 'Commit failed' }, { status: 500 });
	}
};
