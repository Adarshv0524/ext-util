import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const db = platform?.env?.MEDIA_DB;
	if (!db || !locals.user || locals.user.role !== 'ADMIN') {
		throw error(403, "Unauthorized");
	}

	// Fetch all images across the system, join with user info
	const assetsResult = await db.prepare(`
		SELECT m.*, u.email as uploader_email, u.name as uploader_name
		FROM media_assets m
		LEFT JOIN users u ON m.uploader_user_id = u.id
		ORDER BY m.uploaded_at DESC
		LIMIT 200
	`).all();
	
	return {
		images: assetsResult.results
	};
};
