import { json, type RequestHandler } from '@sveltejs/kit';
import {
	deleteAssetRecord,
	findAbandonedInlineAssets,
	findExpiredUncommittedAssets
} from '$lib/server/db';
import { getEnv } from '$lib/server/config';

export const POST: RequestHandler = async ({ platform }) => {
	try {
		const purgedKeys: string[] = [];

		const env = getEnv(platform?.env);

		// Pass 1: Purge uncommitted assets past expires_at
		const expiredAssets = await findExpiredUncommittedAssets(env);
		let purgedUncommittedCount = 0;

		for (const asset of expiredAssets) {
			if (env.R2_BUCKET) {
				await env.R2_BUCKET.delete(asset.r2_object_key);
			}
			await deleteAssetRecord(env, asset.r2_object_key);
			purgedKeys.push(asset.r2_object_key);
			purgedUncommittedCount++;
		}

		// Pass 2: Clean up abandoned inline article images older than 24 hours
		const abandonedInline = await findAbandonedInlineAssets(env);
		let purgedAbandonedInlineCount = 0;

		for (const asset of abandonedInline) {
			if (!purgedKeys.includes(asset.r2_object_key)) {
				if (env.R2_BUCKET) {
					await env.R2_BUCKET.delete(asset.r2_object_key);
				}
				await deleteAssetRecord(env, asset.r2_object_key);
				purgedKeys.push(asset.r2_object_key);
				purgedAbandonedInlineCount++;
			}
		}

		return json({
			success: true,
			timestamp: new Date().toISOString(),
			purged_uncommitted_count: purgedUncommittedCount,
			purged_abandoned_inline_count: purgedAbandonedInlineCount,
			total_purged: purgedKeys.length,
			purged_keys: purgedKeys
		});
	} catch (err: any) {
		return json({ error: err.message || 'Orphan cleanup failed' }, { status: 500 });
	}
};
