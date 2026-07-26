import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

// Optionally initialized if key is provided
let resend: Resend | null = null;
if (env.RESEND_API_KEY) {
	resend = new Resend(env.RESEND_API_KEY);
}

export async function sendAdminNotification(newUserEmail: string, newUserName: string) {
	if (!resend || !env.ADMIN_EMAILS) return;

	const admins = env.ADMIN_EMAILS.split(',').map(e => e.trim());

	try {
		await resend.emails.send({
			from: 'Avadhya ImgAPI <onboarding@resend.dev>', // Update this to your verified domain in production
			to: admins,
			subject: `New Developer Request: ${newUserName}`,
			html: `
				<h2>New Access Request</h2>
				<p>A new developer has signed up and is waiting for approval.</p>
				<ul>
					<li><strong>Name:</strong> ${newUserName}</li>
					<li><strong>Email:</strong> ${newUserEmail}</li>
				</ul>
				<p><a href="${env.APP_URL || 'http://localhost:5173'}/admin">Go to Admin Dashboard to approve them.</a></p>
			`
		});
	} catch (e) {
		console.error("Failed to send admin notification:", e);
	}
}
