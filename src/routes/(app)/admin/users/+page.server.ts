import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import { sendUserApprovedEmail, sendUserBannedEmail } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const db = platform?.env?.MEDIA_DB;
	if (!db || !locals.user || locals.user.role !== 'ADMIN') {
		throw error(403, "Unauthorized");
	}

	const usersResult = await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
	const settingsResult = await db.prepare("SELECT value FROM settings WHERE key = 'AUTO_APPROVE_USERS'").first();
	const emailsResult = await db.prepare("SELECT value FROM settings WHERE key = 'ADMIN_NOTIFICATION_EMAILS'").first();
	
	return {
		users: usersResult.results,
		autoApprove: settingsResult?.value === 'true',
		notificationEmails: emailsResult?.value as string || ''
	};
};

export const actions: Actions = {
	toggleAutoApprove: async ({ request, platform, locals }) => {
		if (locals.user?.role !== 'ADMIN') throw error(403, "Unauthorized");
		const db = platform?.env?.MEDIA_DB;
		if (!db) throw error(500, "DB unavailable");

		const data = await request.formData();
		const autoApprove = data.get('autoApprove') === 'true' ? 'true' : 'false';

		await db.prepare("UPDATE settings SET value = ? WHERE key = 'AUTO_APPROVE_USERS'").bind(autoApprove).run();
		return { success: true };
	},

	updateNotificationEmails: async ({ request, platform, locals }) => {
		if (locals.user?.role !== 'ADMIN') throw error(403, "Unauthorized");
		const db = platform?.env?.MEDIA_DB;
		if (!db) throw error(500, "DB unavailable");

		const data = await request.formData();
		const emails = data.get('emails') as string;

		await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ADMIN_NOTIFICATION_EMAILS', ?)").bind(emails).run();
		return { success: true };
	},

	updateUserStatus: async ({ request, platform, locals }) => {
		if (locals.user?.role !== 'ADMIN') throw error(403, "Unauthorized");
		const db = platform?.env?.MEDIA_DB;
		if (!db) throw error(500, "DB unavailable");

		const data = await request.formData();
		const userId = data.get('userId') as string;
		const newStatus = data.get('status') as string;

		if (!['PENDING', 'APPROVED', 'BANNED'].includes(newStatus)) {
			throw error(400, "Invalid status");
		}

		// Fetch the current user to see their email and previous status
		const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<{ email: string; name: string; status: string }>();
		if (!user) {
			throw error(404, "User not found");
		}

		// Clear approval_token if they are approved
		if (newStatus === 'APPROVED') {
			await db.prepare("UPDATE users SET status = ?, approval_token = NULL WHERE id = ?").bind(newStatus, userId).run();
		} else {
			await db.prepare("UPDATE users SET status = ? WHERE id = ?").bind(newStatus, userId).run();
		}

		// Only send email if status actually changed
		if (user.status !== newStatus) {
			if (newStatus === 'APPROVED') {
				platform?.context?.waitUntil(sendUserApprovedEmail(user.email, user.name));
			} else if (newStatus === 'BANNED') {
				platform?.context?.waitUntil(sendUserBannedEmail(user.email, user.name));
			}
		}

		return { success: true };
	}
};
