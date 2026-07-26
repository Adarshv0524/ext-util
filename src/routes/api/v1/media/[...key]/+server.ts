import { json, type RequestHandler } from '@sveltejs/kit';
import { deleteAssetRecord, getAssetByKey } from '$lib/server/db';

export const DELETE: RequestHandler = async ({ params, platform, locals, url }) => {
	try {
		const objectKey = params.key;
		if (!objectKey) {
			return json({ error: 'Missing object key in request path.' }, { status: 400 });
		}

		const userIdStr = url.searchParams.get('user_id');
		const actorUserId = locals.user?.id || (userIdStr ? parseInt(userIdStr, 10) : 1);

		// 1. Fetch asset record
		const asset = await getAssetByKey(platform?.env, objectKey);
		if (asset && asset.uploader_user_id !== actorUserId && locals.user?.role !== 'admin') {
			return json(
				{ error: 'Forbidden: You do not own this media asset.' },
				{ status: 403 }
			);
		}

		// 2. Purge from R2 storage bucket
		if (platform?.env?.R2_BUCKET) {
			await platform.env.R2_BUCKET.delete(objectKey);
		}

		// 3. Remove record from lifecycle ledger
		await deleteAssetRecord(platform?.env, objectKey);

		return json({
			success: true,
			deleted_object_key: objectKey,
			message: 'Asset successfully purged from R2 storage and lifecycle ledger.'
		});
	} catch (err: any) {
		return json({ error: err.message || 'Deletion failed' }, { status: 500 });
	}
};
