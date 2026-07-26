import { sendUserApprovedEmail } from '$lib/server/email';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({ url, platform }: RequestEvent) => {
	const token = url.searchParams.get('token');
	const userId = url.searchParams.get('userId');

	if (!token || !userId) {
		return new Response('Missing token or userId', { status: 400 });
	}

	const db = platform?.env?.MEDIA_DB;
	if (!db) {
		return new Response('Database unavailable', { status: 500 });
	}

	try {
		// Verify token and user
		const user = (await db.prepare('SELECT * FROM users WHERE id = ? AND approval_token = ? AND status = ?')
			.bind(userId, token, 'PENDING')
			.first()) as { id: string; email: string; name: string } | null;

		if (!user) {
			return new Response(`
				<!DOCTYPE html>
				<html>
				<body style="font-family: sans-serif; text-align: center; padding: 50px;">
					<h2 style="color: #ef4444;">Invalid or Expired Link</h2>
					<p>This approval link is invalid or the user has already been approved.</p>
				</body>
				</html>
			`, { status: 400, headers: { 'Content-Type': 'text/html' } });
		}

		// Approve user and clear token
		await db.prepare('UPDATE users SET status = ?, approval_token = NULL WHERE id = ?')
			.bind('APPROVED', userId)
			.run();

		// Send approved email to user
		platform?.context?.waitUntil(
			sendUserApprovedEmail(user.email, user.name)
		);

		return new Response(`
			<!DOCTYPE html>
			<html>
			<body style="font-family: sans-serif; text-align: center; padding: 50px;">
				<h2 style="color: #22c55e;">Success!</h2>
				<p>User <strong>${user.name}</strong> (${user.email}) has been successfully approved.</p>
			</body>
			</html>
		`, { status: 200, headers: { 'Content-Type': 'text/html' } });

	} catch (e) {
		console.error("Failed to approve user from email:", e);
		return new Response('Internal Server Error', { status: 500 });
	}
};
