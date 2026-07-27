import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({ cookies, platform }: RequestEvent) => {
	const sessionId = cookies.get('session');
	
	if (sessionId) {
		const db = platform?.env?.MEDIA_DB;
		if (db) {
			try {
				await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
			} catch (e) {
				console.error("Failed to delete session from DB", e);
			}
		}
		cookies.delete('session', { path: '/' });
	}
	
	throw redirect(302, '/');
};
