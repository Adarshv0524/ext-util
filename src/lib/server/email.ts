import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

export async function sendAdminNotification(newUserEmail: string, newUserName: string, adminEmailsOverride?: string) {
	const finalAdminEmails = adminEmailsOverride || env.ADMIN_EMAILS;

	if (!env.RESEND_API_KEY || !finalAdminEmails) {
		console.warn('Missing RESEND_API_KEY or ADMIN_EMAILS environment variable / setting');
		return;
	}

	const resend = new Resend(env.RESEND_API_KEY);
	const admins = finalAdminEmails.split(',').map(e => e.trim());

	try {
		await resend.emails.send({
			from: 'Avadhya ImgAPI <onboarding@resend.dev>', // Update this to your verified domain in production
			to: admins,
			subject: `New Developer Request: ${newUserName}`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>New Access Request</title>
			</head>
			<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b;">
				<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f4f4f5; padding: 40px 0;">
					<tr>
						<td align="center">
							<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
								<!-- Header -->
								<tr>
									<td style="background-color: #4f46e5; padding: 32px 40px; text-align: center;">
										<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">imgapi</h1>
									</td>
								</tr>
								
								<!-- Body -->
								<tr>
									<td style="padding: 40px;">
										<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #18181b;">New Access Request</h2>
										<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #52525b;">
											A new developer has signed up for imgapi and is waiting for your approval to start using the platform.
										</p>
										
										<!-- User Details Box -->
										<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 32px;">
											<tr>
												<td style="padding: 20px;">
													<p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;"><strong>Name:</strong> <span style="color: #0f172a;">${newUserName}</span></p>
													<p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Email:</strong> <span style="color: #0f172a;">${newUserEmail}</span></p>
												</td>
											</tr>
										</table>
										
										<!-- Action Button -->
										<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
											<tr>
												<td align="center">
													<a href="${env.APP_URL || 'http://localhost:5173'}/admin" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none; padding: 12px 24px; border-radius: 6px; text-align: center;">Go to Admin Dashboard</a>
												</td>
											</tr>
										</table>
									</td>
								</tr>
								
								<!-- Footer -->
								<tr>
									<td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
										<p style="margin: 0; font-size: 13px; color: #94a3b8;">
											This is an automated message from imgapi.
										</p>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</body>
			</html>
			`
		});
	} catch (e) {
		console.error("Failed to send admin notification:", e);
	}
}
