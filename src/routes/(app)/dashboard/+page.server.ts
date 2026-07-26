import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import { generateId } from '$lib/server/auth';

// Web crypto for HMAC secret generation
function generateHmacSecret() {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const load: PageServerLoad = async ({ locals, platform }) => {
	const db = platform?.env?.MEDIA_DB;
	if (!db || !locals.user) {
		throw error(500, "Database unavailable");
	}

	const projectsResult = await db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC').bind(locals.user.id).all();
	
	return {
		projects: projectsResult.results,
		user: locals.user
	};
};

export const actions: Actions = {
	createProject: async ({ request, platform, locals }) => {
		if (!locals.user || locals.user.status !== 'APPROVED') {
			throw error(403, "Unauthorized");
		}
		
		const db = platform?.env?.MEDIA_DB;
		if (!db) throw error(500, "DB unavailable");

		const data = await request.formData();
		const name = data.get('name') as string;
		
		if (!name || name.length < 2) {
			throw error(400, "Project name must be at least 2 characters");
		}

		// generate a slug from the name
		let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
		if (!slug) slug = generateId(8);
		
		// Ensure slug uniqueness for this user
		const existing = await db.prepare("SELECT id FROM projects WHERE project_slug = ? AND user_id = ?").bind(slug, locals.user.id).first();
		if (existing) {
			slug = `${slug}-${generateId(4)}`;
		}

		const projectId = generateId(15);
		const hmacSecret = generateHmacSecret();

		await db.prepare(
			'INSERT INTO projects (id, user_id, name, project_slug, hmac_secret) VALUES (?, ?, ?, ?, ?)'
		).bind(projectId, locals.user.id, name, slug, hmacSecret).run();

		return { success: true };
	},

	regenerateSecret: async ({ request, platform, locals }) => {
		if (!locals.user || locals.user.status !== 'APPROVED') throw error(403, "Unauthorized");
		const db = platform?.env?.MEDIA_DB;
		if (!db) throw error(500, "DB unavailable");

		const data = await request.formData();
		const projectId = data.get('projectId') as string;

		// Verify ownership
		const project = await db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').bind(projectId, locals.user.id).first();
		if (!project) throw error(403, "Forbidden");

		const newSecret = generateHmacSecret();
		await db.prepare('UPDATE projects SET hmac_secret = ? WHERE id = ?').bind(newSecret, projectId).run();

		return { success: true };
	}
};
