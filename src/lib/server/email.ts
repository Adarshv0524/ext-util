import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

const defaultSender = env.EMAIL_FROM || 'ImgAPI <noreply@imgapi.avadhya.in>';

export async function sendAdminNotification(newUserEmail: string, newUserName: string, adminEmailsOverride?: string, approvalUrl?: string) {
	const finalAdminEmails = adminEmailsOverride || env.ADMIN_EMAILS;

	if (!env.RESEND_API_KEY || !finalAdminEmails) {
		console.warn('Missing RESEND_API_KEY or ADMIN_EMAILS environment variable / setting');
		return;
	}

	const resend = new Resend(env.RESEND_API_KEY);
	const admins = finalAdminEmails.split(',').map(e => e.trim());
	
	const defaultAdminUrl = `${env.APP_URL || 'http://localhost:5173'}/admin`;
	
	const actionButtonHtml = approvalUrl ? `
		<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
			<tr>
				<td align="center" style="padding-bottom: 16px;">
					<a href="${approvalUrl}" style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none; padding: 12px 24px; border-radius: 6px; text-align: center;">Approve User Directly</a>
				</td>
			</tr>
			<tr>
				<td align="center">
					<a href="${defaultAdminUrl}" style="display: inline-block; color: #4f46e5; font-size: 14px; font-weight: 500; text-decoration: underline; text-align: center;">Or go to Admin Dashboard</a>
				</td>
			</tr>
		</table>
	` : `
		<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
			<tr>
				<td align="center">
					<a href="${defaultAdminUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none; padding: 12px 24px; border-radius: 6px; text-align: center;">Go to Admin Dashboard</a>
				</td>
			</tr>
		</table>
	`;

	try {
		await resend.emails.send({
			from: defaultSender,
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
										${actionButtonHtml}
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

export async function sendWelcomePendingEmail(userEmail: string, userName: string) {
	if (!env.RESEND_API_KEY) return;
	const resend = new Resend(env.RESEND_API_KEY);

	try {
		await resend.emails.send({
			from: defaultSender,
			to: userEmail,
			subject: `Welcome to imgapi! Your request is pending`,
			html: `
			<!DOCTYPE html>
			<html>
			<body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f4f4f5; color: #18181b;">
				<div style="max-width: 600px; margin: 40px auto; background: #fff; padding: 40px; border-radius: 12px;">
					<h2 style="color: #4f46e5; margin-top: 0;">Hi ${userName},</h2>
					<p style="font-size: 16px; line-height: 24px; color: #52525b;">
						Welcome to imgapi! We have received your request for access. 
					</p>
					<p style="font-size: 16px; line-height: 24px; color: #52525b;">
						Our team is currently reviewing it, and it will get approved soon. 
						You will receive another email as soon as you can start using the platform.
					</p>
					<p style="font-size: 14px; color: #94a3b8; margin-top: 40px;">
						Thanks,<br/>The imgapi Team
					</p>
				</div>
			</body>
			</html>
			`
		});
	} catch (e) {
		console.error("Failed to send welcome email:", e);
	}
}

export async function sendUserApprovedEmail(userEmail: string, userName: string) {
	if (!env.RESEND_API_KEY) return;
	const resend = new Resend(env.RESEND_API_KEY);
	const appUrl = env.APP_URL || 'http://localhost:5173';

	try {
		await resend.emails.send({
			from: defaultSender,
			to: userEmail,
			subject: `Congratulations! Your imgapi access is approved`,
			html: `
			<!DOCTYPE html>
			<html>
			<body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f4f4f5; color: #18181b;">
				<div style="max-width: 600px; margin: 40px auto; background: #fff; padding: 40px; border-radius: 12px;">
					<h2 style="color: #22c55e; margin-top: 0;">Congratulations ${userName}!</h2>
					<p style="font-size: 16px; line-height: 24px; color: #52525b;">
						Your access request has been approved. You can now log in and start using imgapi.
					</p>
					<div style="margin: 32px 0;">
						<a href="${appUrl}/dashboard" style="background-color: #4f46e5; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; display: inline-block;">Go to Dashboard</a>
					</div>
					<p style="font-size: 14px; color: #94a3b8;">
						Happy building!<br/>The imgapi Team
					</p>
				</div>
			</body>
			</html>
			`
		});
	} catch (e) {
		console.error("Failed to send approval email:", e);
	}
}

export async function sendUserBannedEmail(userEmail: string, userName: string) {
	if (!env.RESEND_API_KEY) return;
	const resend = new Resend(env.RESEND_API_KEY);

	try {
		await resend.emails.send({
			from: defaultSender,
			to: userEmail,
			subject: `Account Suspended`,
			html: `
			<!DOCTYPE html>
			<html>
			<body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f4f4f5; color: #18181b;">
				<div style="max-width: 600px; margin: 40px auto; background: #fff; padding: 40px; border-radius: 12px;">
					<h2 style="color: #ef4444; margin-top: 0;">Hi ${userName},</h2>
					<p style="font-size: 16px; line-height: 24px; color: #52525b;">
						Your access to imgapi has been suspended by an administrator.
					</p>
					<p style="font-size: 16px; line-height: 24px; color: #52525b;">
						If you believe this is an error, please reply to this email.
					</p>
					<p style="font-size: 14px; color: #94a3b8; margin-top: 40px;">
						The imgapi Team
					</p>
				</div>
			</body>
			</html>
			`
		});
	} catch (e) {
		console.error("Failed to send banned email:", e);
	}
}

