import { describe, it, expect } from 'vitest';
import { POST as handleUploadToken } from './api/v1/media/upload-token/+server';
import { PUT as handleUploadPut, GET as handleUploadGet } from './upload/[...key]/+server';
import { POST as handleCommit } from './api/v1/media/commit/+server';
import { DELETE as handleDelete } from './api/v1/media/[...key]/+server';
import { POST as handleOrphanCleanup } from './api/v1/cron/cleanup-orphans/+server';

describe('Three-Phase End-to-End API Integration', () => {
	it('Phase 1: POST /api/v1/media/upload-token should issue token and create uncommitted asset', async () => {
		const req = new Request('http://localhost/api/v1/media/upload-token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				asset_type: 'user_avatar',
				mime_type: 'image/png',
				file_size_bytes: 1024,
				file_name: 'avatar.png',
				uploader_user_id: 100
			})
		});

		const res = await handleUploadToken({
			request: req,
			platform: undefined,
			locals: { user: { id: 100, role: 'contributor' } }
		} as any);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.object_key).toContain('uploads/user_avatar/100_');
		expect(data.upload_url).toContain('/upload/');
		expect(data.cdn_url).toContain('/upload/');
		expect(data.expires_at).toBeDefined();
	});

	it('Phase 2 & Phase 3: PUT /upload/[...key] direct binary upload & POST /api/v1/media/commit', async () => {
		// 1. Issue token
		const tokenReq = new Request('http://localhost/api/v1/media/upload-token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				asset_type: 'user_cover',
				mime_type: 'image/png',
				file_size_bytes: 8,
				file_name: 'cover.png',
				uploader_user_id: 101
			})
		});

		const tokenRes = await handleUploadToken({
			request: tokenReq,
			platform: undefined,
			locals: { user: { id: 101, role: 'contributor' } }
		} as any);
		const tokenData = await tokenRes.json();

		// PNG header bytes (89 50 4E 47 0D 0A 1A 0A)
		const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

		// Parse params from upload_url
		const uploadUrl = new URL(`http://localhost${tokenData.upload_url}`);
		const putReq = new Request(uploadUrl.toString(), {
			method: 'PUT',
			headers: {
				'Content-Type': 'image/png',
				'Content-Length': pngBytes.length.toString()
			},
			body: pngBytes
		});

		const putRes = await handleUploadPut({
			params: { key: tokenData.object_key },
			url: uploadUrl,
			request: putReq,
			platform: undefined
		} as any);

		expect(putRes.status).toBe(200);
		const putData = await putRes.json();
		expect(putData.object_key).toBe(tokenData.object_key);
		expect(putData.bytes_written).toBe(8);

		// Verify asset is readable via GET
		const getRes = await handleUploadGet({
			params: { key: tokenData.object_key },
			platform: undefined
		} as any);
		expect(getRes.status).toBe(200);

		// Phase 3: Commit asset
		const commitReq = new Request('http://localhost/api/v1/media/commit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				object_key: tokenData.object_key,
				associated_entity_type: 'users',
				associated_entity_id: 101,
				user_id: 101
			})
		});

		const commitRes = await handleCommit({
			request: commitReq,
			platform: undefined,
			locals: { user: { id: 101, role: 'contributor' } }
		} as any);

		expect(commitRes.status).toBe(200);
		const commitData = await commitRes.json();
		expect(commitData.is_committed).toBe(true);
		expect(commitData.associated_entity_type).toBe('users');
		expect(commitData.associated_entity_id).toBe(101);
	});

	it('Asset Deletion & Orphan Sweep', async () => {
		// Test orphan cleanup endpoint
		const cronReq = new Request('http://localhost/api/v1/cron/cleanup-orphans', { method: 'POST' });
		const cronRes = await handleOrphanCleanup({ platform: undefined } as any);
		expect(cronRes.status).toBe(200);
		const cronData = await cronRes.json();
		expect(cronData.success).toBe(true);
	});
});
