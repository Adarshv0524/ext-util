import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const db = platform?.env?.MEDIA_DB;
	if (!db || !locals.user || locals.user.role !== 'ADMIN') {
		throw error(403, "Unauthorized");
	}

	// Fetch all projects along with their owner's info
	const projectsResult = await db.prepare(`
		SELECT p.*, u.email as owner_email, u.name as owner_name 
		FROM projects p
		LEFT JOIN users u ON p.user_id = u.id
		ORDER BY p.created_at DESC
	`).all();
	
	return {
		projects: projectsResult.results
	};
};
