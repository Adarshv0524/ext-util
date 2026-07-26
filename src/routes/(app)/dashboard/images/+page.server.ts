import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const db = platform?.env?.MEDIA_DB;
	if (!db || !locals.user) {
		throw error(500, "Database unavailable");
	}

	// Fetch all images uploaded by the user
	const assetsResult = await db.prepare(
		'SELECT * FROM media_assets WHERE uploader_user_id = ? ORDER BY uploaded_at DESC'
	).bind(locals.user.id).all();
	
	return {
		images: assetsResult.results
	};
};
