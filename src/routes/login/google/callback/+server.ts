import { redirect, isRedirect } from '@sveltejs/kit';
import { getGoogleOAuth, generateId } from '$lib/server/auth';
import { sendAdminNotification } from '$lib/server/email';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	
	const storedState = event.cookies.get('google_oauth_state') ?? null;
	const storedCodeVerifier = event.cookies.get('google_code_verifier') ?? null;

	if (!code || !state || !storedState || !storedCodeVerifier || state !== storedState) {
		return new Response('Invalid state', { status: 400 });
	}

	try {
		const google = getGoogleOAuth();
		const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
		
		const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`
			}
		});
		
		const googleUser = await response.json() as {
			sub: string;
			email: string;
			name: string;
			picture: string;
		};

		const db = event.platform?.env?.MEDIA_DB;
		if (!db) {
			throw new Error("D1 database not found in platform env");
		}

		// 1. Check if user exists
		const existingUser = await db.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleUser.sub).first();
		let userId = existingUser?.id as string;

		if (!existingUser) {
			userId = generateId(20);
			// Check if they are admin
			const adminEmails = (env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
			const isAdmin = adminEmails.includes(googleUser.email.toLowerCase());
			const role = isAdmin ? 'ADMIN' : 'USER';
			
			// Check auto-approve setting from DB
			let autoApprove = false;
			try {
				const setting = await db.prepare("SELECT value FROM settings WHERE key = 'AUTO_APPROVE_USERS'").first();
				if (setting && setting.value === 'true') autoApprove = true;
			} catch (e) {
				console.error("Failed to read settings", e);
			}

			// Admins are always approved
			const status = (isAdmin || autoApprove) ? 'APPROVED' : 'PENDING';

			await db.prepare(
				'INSERT INTO users (id, google_id, email, name, picture, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
			).bind(userId, googleUser.sub, googleUser.email, googleUser.name, googleUser.picture, role, status).run();

			// Get notification emails setting
			let adminEmailsOverride = undefined;
			try {
				const setting = await db.prepare("SELECT value FROM settings WHERE key = 'ADMIN_NOTIFICATION_EMAILS'").first();
				if (setting && setting.value) adminEmailsOverride = setting.value as string;
			} catch (e) {
				console.error("Failed to read admin notification emails setting", e);
			}

			// Send email via Resend in the background for ALL new signups
			event.platform?.context?.waitUntil(
				sendAdminNotification(googleUser.email, googleUser.name, adminEmailsOverride)
			);
		}

		// 2. Create session
		const sessionId = generateId(40);
		// 30 days expiry
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
		
		await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
			.bind(sessionId, userId, expiresAt.toISOString()).run();

		// 3. Set cookie
		event.cookies.set('session', sessionId, {
			path: '/',
			secure: import.meta.env.PROD,
			httpOnly: true,
			maxAge: 60 * 60 * 24 * 30,
			expires: expiresAt,
			sameSite: 'lax'
		});

		throw redirect(302, '/dashboard');
	} catch (e) {
		if (isRedirect(e)) {
			throw e; // SvelteKit redirects must always be rethrown
		}
		console.error("OAuth error:", e);
		return new Response(
			`OAuth Error: ${e instanceof Error ? e.message : 'Unknown error'}`,
			{ status: 500 }
		);
	}
};
