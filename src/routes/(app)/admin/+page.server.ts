import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const db = platform?.env?.MEDIA_DB;
	if (!db || !locals.user || locals.user.role !== 'ADMIN') {
		throw error(403, "Unauthorized");
	}

	// Fetch some basic stats for the dashboard
	const usersCountResult = await db.prepare('SELECT COUNT(*) as count FROM users').first();
	const projectsCountResult = await db.prepare('SELECT COUNT(*) as count FROM projects').first();
	const imagesCountResult = await db.prepare('SELECT COUNT(*) as count FROM media_assets').first();
	
	return {
		stats: {
			users: usersCountResult?.count || 0,
			projects: projectsCountResult?.count || 0,
			images: imagesCountResult?.count || 0
		}
	};
};
