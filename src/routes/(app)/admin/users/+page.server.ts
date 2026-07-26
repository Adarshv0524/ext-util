import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';

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
		const status = data.get('status') as string;

		if (!['PENDING', 'APPROVED', 'BANNED'].includes(status)) {
			throw error(400, "Invalid status");
		}

		await db.prepare("UPDATE users SET status = ? WHERE id = ?").bind(status, userId).run();
		return { success: true };
	}
};
