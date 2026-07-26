import type { Handle } from '@sveltejs/kit';
import type { User, Session } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');
	
	if (!sessionId) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const db = event.platform?.env?.MEDIA_DB;
	if (!db) {
		console.warn('D1 Database not available in hooks');
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	// Validate Session against DB
	try {
		const result = await db.prepare(`
			SELECT sessions.*, users.id as u_id, users.google_id, users.email, users.name, users.picture, users.role, users.status, users.created_at
			FROM sessions
			INNER JOIN users ON users.id = sessions.user_id
			WHERE sessions.id = ?
		`).bind(sessionId).first();

		if (!result) {
			event.locals.user = null;
			event.locals.session = null;
			event.cookies.delete('session', { path: '/' });
		} else {
			const expiresAt = new Date(result.expires_at as string);
			if (expiresAt.getTime() < Date.now()) {
				// Expired
				event.locals.user = null;
				event.locals.session = null;
				await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
				event.cookies.delete('session', { path: '/' });
			} else {
				// Valid
				event.locals.session = {
					id: result.id as string,
					user_id: result.user_id as string,
					expires_at: expiresAt
				};
				event.locals.user = {
					id: result.u_id as string,
					google_id: result.google_id as string,
					email: result.email as string,
					name: result.name as string | null,
					picture: result.picture as string | null,
					role: result.role as 'USER' | 'ADMIN',
					status: result.status as 'PENDING' | 'APPROVED' | 'BANNED',
					created_at: result.created_at as string
				};
			}
		}
	} catch (e) {
		console.error("Session validation error:", e);
		event.locals.user = null;
		event.locals.session = null;
	}

	// Route Protection Logic
	if (event.url.pathname.startsWith('/dashboard')) {
		if (!event.locals.user) {
			return new Response('Redirect', { status: 303, headers: { Location: '/' } });
		}
		if (event.locals.user.status === 'PENDING') {
			return new Response('Redirect', { status: 303, headers: { Location: '/pending-approval' } });
		}
		if (event.locals.user.status === 'BANNED') {
			return new Response('Account Banned', { status: 403 });
		}
	}

	if (event.url.pathname.startsWith('/admin')) {
		if (!event.locals.user || event.locals.user.role !== 'ADMIN') {
			return new Response('Forbidden', { status: 403 });
		}
	}

	return resolve(event);
};
