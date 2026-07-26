<script lang="ts">
	import { onMount } from 'svelte';
	import { uploadImage, requestUploadToken, uploadToR2, commitAsset } from '$lib/client/media';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { AwadImageExtension } from '$lib/client/AwadImageExtension';

	// Reactive states
	let selectedAssetType = $state<'user_avatar' | 'user_cover' | 'author_cover' | 'work_cover' | 'article_inline'>('user_avatar');
	let selectedFile = $state<File | null>(null);
	let uploadStatus = $state<string>('');
	let uploadLogs = $state<string[]>([]);
	let resultCdnUrl = $state<string>('');
	let resultObjectKey = $state<string>('');
	let isUploading = $state<boolean>(false);

	// Security Test Workbench states
	let testLog = $state<string>('');

	// Tiptap state
	let editorElement = $state<HTMLDivElement | null>(null);
	let editor = $state<Editor | null>(null);
	let tiptapHtml = $state<string>('');

	// Orphan sweep state
	let sweepResult = $state<any | null>(null);
	let isSweeping = $state<boolean>(false);

	function log(msg: string) {
		uploadLogs = [...uploadLogs, `[${new Date().toLocaleTimeString()}] ${msg}`];
	}

	onMount(() => {
		if (editorElement) {
			editor = new Editor({
				element: editorElement,
				extensions: [StarterKit, AwadImageExtension],
				content: `
					<h2>Awadhi Article Canvas with Decoupled Image Upload</h2>
					<p>Paste or drop any image file directly onto this editor canvas to test <strong>Phase 1 presigned token issuance</strong> and <strong>Phase 2 direct binary edge stream write</strong> without proxying through application server RAM!</p>
				`,
				onUpdate: ({ editor }) => {
					tiptapHtml = editor.getHTML();
				}
			});
			tiptapHtml = editor.getHTML();
		}

		return () => {
			editor?.destroy();
		};
	});

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			selectedFile = target.files[0];
		}
	}

	async function runThreePhaseUpload() {
		if (!selectedFile) return;
		isUploading = true;
		uploadLogs = [];
		resultCdnUrl = '';
		resultObjectKey = '';

		try {
			log(`🚀 Starting Three-Phase Upload for '${selectedFile.name}' (${(selectedFile.size / 1024).toFixed(1)} KB)`);

			// Phase 1: Request presigned upload token
			log(`Phase 1: POST /api/v1/media/upload-token (Requesting HMAC Token & DB ledger entry)...`);
			const tokenResp = await requestUploadToken({
				asset_type: selectedAssetType,
				mime_type: selectedFile.type,
				file_size_bytes: selectedFile.size,
				file_name: selectedFile.name,
				uploader_user_id: 42
			});
			log(`✅ Phase 1 Success! Token issued. Key: ${tokenResp.object_key}`);
			log(`   Upload URL: ${tokenResp.upload_url}`);

			// Phase 2: Direct Binary PUT Stream to R2 Edge
			log(`Phase 2: PUT /upload/${tokenResp.object_key} (Direct Binary Stream to Edge)...`);
			const uploadResp = await uploadToR2(tokenResp.upload_url, selectedFile);
			log(`✅ Phase 2 Success! Binary wrote ${uploadResp.bytes_written} bytes directly to R2 edge.`);

			// Phase 3: Metadata Commit
			log(`Phase 3: POST /api/v1/media/commit (Locking is_committed = true)...`);
			const commitResp = await commitAsset({
				object_key: tokenResp.object_key,
				associated_entity_type: 'users',
				associated_entity_id: 42
			});
			log(`✅ Phase 3 Success! Asset committed at ${commitResp.committed_at}`);

			resultCdnUrl = commitResp.cdn_url;
			resultObjectKey = commitResp.object_key;
			uploadStatus = 'Three-Phase Upload Completed Successfully!';
		} catch (err: any) {
			log(`❌ ERROR: ${err.message || err}`);
			uploadStatus = `Upload Failed: ${err.message}`;
		} finally {
			isUploading = false;
		}
	}

	// Security Rejection Verification Helpers
	async function testExpiredToken() {
		testLog = 'Testing Expired Token (> 5 min)...';
		try {
			const res = await fetch('/upload/test_expired.webp?user_id=1&mime=image/webp&expires=1000000000&token=invalid_token', {
				method: 'PUT',
				body: new Uint8Array([1, 2, 3])
			});
			const data = await res.json();
			testLog = `Result HTTP ${res.status}: ${JSON.stringify(data)}`;
		} catch (e: any) {
			testLog = `Failed: ${e.message}`;
		}
	}

	async function testMagicByteMismatch() {
		testLog = 'Testing Magic Byte Mismatch (.exe disguised as .jpg)...';
		try {
			// Request valid token for JPEG
			const tokenResp = await requestUploadToken({
				asset_type: 'user_avatar',
				mime_type: 'image/jpeg',
				file_size_bytes: 100,
				file_name: 'malicious.jpg'
			});

			// Upload payload with fake bytes (MZ executable header 0x4D 0x5A) instead of JPEG 0xFF 0xD8 0xFF
			const fakeExeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
			const res = await fetch(tokenResp.upload_url, {
				method: 'PUT',
				headers: { 'Content-Type': 'image/jpeg' },
				body: fakeExeBytes
			});
			const data = await res.json();
			testLog = `Result HTTP ${res.status}: ${JSON.stringify(data)}`;
		} catch (e: any) {
			testLog = `Failed: ${e.message}`;
		}
	}

	async function testSizeCapExceeded() {
		testLog = 'Testing Size Cap Exceeded (Requesting 20MB avatar)...';
		try {
			const tokenResp = await requestUploadToken({
				asset_type: 'user_avatar',
				mime_type: 'image/png',
				file_size_bytes: 20 * 1024 * 1024, // 20 MB (limit is 2 MB)
				file_name: 'huge.png'
			});
			testLog = `Unexpected Success: ${JSON.stringify(tokenResp)}`;
		} catch (e: any) {
			testLog = `Expected Rejection Caught: ${e.message}`;
		}
	}

	async function runOrphanCleanup() {
		isSweeping = true;
		sweepResult = null;
		try {
			const res = await fetch('/api/v1/cron/cleanup-orphans', { method: 'POST' });
			sweepResult = await res.json();
		} catch (e: any) {
			sweepResult = { error: e.message };
		} finally {
			isSweeping = false;
		}
	}
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
	<!-- Hero Header -->
	<div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-slate-800 p-8 shadow-2xl">
		<div class="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
		<div class="relative z-10 max-w-3xl">
			<span class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
				Cloudflare Edge &bull; SvelteKit Architecture
			</span>
			<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
				Decoupled Image Upload Microservice (<code class="text-emerald-400 font-mono">ext-util</code>)
			</h1>
			<p class="text-slate-300 text-sm sm:text-base leading-relaxed">
				Zero binary payload proxying on application servers. Handles presigned HMAC tokens, direct binary edge streaming to Cloudflare R2, magic-byte MIME validation, Tiptap editor integration, and automated orphan asset sweeps.
			</p>
		</div>
	</div>

	<!-- Main Grid: 3-Phase Upload & Security Workbench -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Section 1: Three-Phase Upload Workbench -->
		<div class="bg-slate-900/70 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
			<div>
				<div class="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
					<h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
						<span class="w-3 h-3 rounded-full bg-indigo-400"></span>
						Three-Phase Upload Workbench
					</h2>
					<span class="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">Phase 1 → Phase 2 → Phase 3</span>
				</div>

				<div class="space-y-4">
					<div>
						<label class="block text-xs font-semibold text-slate-300 mb-1.5" for="assetTypeSelect">Select Asset Type & Size Cap</label>
						<select
							id="assetTypeSelect"
							bind:value={selectedAssetType}
							class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
						>
							<option value="user_avatar">user_avatar (Max 2 MB)</option>
							<option value="user_cover">user_cover (Max 10 MB)</option>
							<option value="author_cover">author_cover (Max 10 MB)</option>
							<option value="work_cover">work_cover (Max 10 MB)</option>
							<option value="article_inline">article_inline (Max 5 MB)</option>
						</select>
					</div>

					<div>
						<label class="block text-xs font-semibold text-slate-300 mb-1.5" for="imageFileInput">Choose Image File</label>
						<input
							id="imageFileInput"
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
							onchange={handleFileChange}
							class="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg p-1.5"
						/>
					</div>

					<button
						onclick={runThreePhaseUpload}
						disabled={!selectedFile || isUploading}
						class="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
					>
						{#if isUploading}
							<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Uploading Binary to R2...
						{:else}
							Execute Three-Phase Protocol
						{/if}
					</button>

					<!-- Upload Logs Console -->
					{#if uploadLogs.length > 0}
						<div class="mt-4 bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto text-xs font-mono space-y-1">
							{#each uploadLogs as logLine}
								<div class={logLine.includes('✅') ? 'text-emerald-400' : logLine.includes('❌') ? 'text-rose-400' : 'text-slate-300'}>
									{logLine}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			{#if resultCdnUrl}
				<div class="mt-6 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-3">
					<div class="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
						<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
						CDN Asset Ready
					</div>
					<div class="text-xs font-mono text-slate-300 break-all bg-slate-950 p-2 rounded border border-slate-800">
						{resultCdnUrl}
					</div>
					<img src={resultCdnUrl} alt="Uploaded Result" class="max-h-40 rounded-lg border border-slate-700 object-cover shadow-md" />
				</div>
			{/if}
		</div>

		<!-- Section 2: Security & Rejection Verification -->
		<div class="bg-slate-900/70 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
			<div>
				<div class="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
					<h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
						<span class="w-3 h-3 rounded-full bg-rose-400"></span>
						Security Rejection Verification
					</h2>
					<span class="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">Defense in Depth</span>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
					<button
						onclick={testExpiredToken}
						class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors text-left"
					>
						<span class="block font-bold text-rose-400 mb-0.5">Test 401</span>
						Expired Token (>5 min)
					</button>

					<button
						onclick={testMagicByteMismatch}
						class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors text-left"
					>
						<span class="block font-bold text-amber-400 mb-0.5">Test 415</span>
						Fake Magic Bytes (.exe)
					</button>

					<button
						onclick={testSizeCapExceeded}
						class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors text-left"
					>
						<span class="block font-bold text-indigo-400 mb-0.5">Test 413</span>
						Exceed Size Cap (20MB)
					</button>
				</div>

				<div class="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 min-h-24">
					<span class="text-slate-500 block mb-1">// Security Test Output:</span>
					{testLog || 'Click any test button above to verify edge defense rejection handling.'}
				</div>
			</div>

			<!-- Orphan Cleanup Job Controls -->
			<div class="mt-8 border-t border-slate-800 pt-6">
				<div class="flex items-center justify-between mb-3">
					<div>
						<h3 class="text-sm font-bold text-slate-200">Orphan Asset Cleanup Job</h3>
						<p class="text-xs text-slate-400">Sweeps uncommitted assets past TTL & abandoned inline images</p>
					</div>
					<button
						onclick={runOrphanCleanup}
						disabled={isSweeping}
						class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors"
					>
						{isSweeping ? 'Sweeping...' : 'Run Cron Sweep'}
					</button>
				</div>

				{#if sweepResult}
					<div class="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 space-y-1">
						<div class="text-emerald-400 font-bold">Cleanup Job Completed:</div>
						<div>Purged Uncommitted: {sweepResult.purged_uncommitted_count || 0}</div>
						<div>Purged Abandoned Inline: {sweepResult.purged_abandoned_inline_count || 0}</div>
						<div>Total Assets Purged: {sweepResult.total_purged || 0}</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Section 3: Tiptap Editor Canvas -->
	<div class="bg-slate-900/70 border border-slate-800 rounded-xl p-6 shadow-xl">
		<div class="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
			<div>
				<h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
					<span class="w-3 h-3 rounded-full bg-emerald-400"></span>
					Tiptap Editor Canvas (<code class="text-indigo-400 font-mono">AwadImageExtension</code>)
				</h2>
				<p class="text-xs text-slate-400">Intercepts drop/paste events, shows optimistic blob preview, streams to R2, replaces with CDN URL</p>
			</div>
			<span class="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">Phase 1 & Phase 2 Only (Phase 3 Skipped)</span>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Tiptap Editor Container -->
			<div class="lg:col-span-2">
				<div
					bind:this={editorElement}
					class="prose prose-invert max-w-none bg-slate-950 border border-slate-800 rounded-xl p-5 min-h-64 focus:outline-none text-slate-200"
				></div>
			</div>

			<!-- Live Document Inspector -->
			<div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col">
				<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Live Document HTML Output</h3>
				<div class="flex-1 font-mono text-[11px] text-indigo-300 break-all overflow-y-auto max-h-64 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80">
					{tiptapHtml}
				</div>
			</div>
		</div>
	</div>
</div>
