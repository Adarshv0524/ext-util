<script lang="ts">
	import { page } from '$app/stores';
	import { uploadToExtUtil } from '$lib/client/media-client';
	import { onMount } from 'svelte';

	let fileInput: HTMLInputElement;
	let isDragging = false;
	let isUploading = false;
	let uploadError: string | null = null;
	let uploadSuccessUrl: string | null = null;
	let thumbnailPreviewUrl: string | null = null;

	// Export Formats
	type ExportFormat = 'url' | 'html' | 'markdown' | 'bbcode';
	let selectedFormat: ExportFormat = 'url';
	let copySuccess = false;

	// Parameters from URL
	$: isDemo = $page.url.searchParams.get('demo') === 'true';
	$: projectId = $page.url.searchParams.get('project_id') || undefined;

	// HTML Styling Options (Initialized from URL if present)
	let htmlOptions = {
		rounded: $page.url.searchParams.get('rounded') === 'true',
		shadow: $page.url.searchParams.get('shadow') === 'true',
		responsive: $page.url.searchParams.get('responsive') !== 'false'
	};

	$: generatedCode = generateCode(selectedFormat, uploadSuccessUrl, htmlOptions);

	function generateCode(format: ExportFormat, url: string | null, options: typeof htmlOptions) {
		if (!url) return '';
		switch (format) {
			case 'url': return url;
			case 'markdown': return `![image](${url})`;
			case 'bbcode': return `[img]${url}[/img]`;
			case 'html':
				let styles = [];
				if (options.rounded) styles.push('border-radius: 8px;');
				if (options.shadow) styles.push('box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);');
				if (options.responsive) styles.push('max-width: 100%; height: auto;');
				const styleAttr = styles.length > 0 ? ` style="${styles.join(' ')}"` : '';
				return `<img src="${url}" alt="image"${styleAttr} />`;
		}
	}

	const handleFileSelect = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			await processFile(target.files[0]);
		}
	};

	const handleDrop = async (e: DragEvent) => {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			await processFile(e.dataTransfer.files[0]);
		}
	};

	const processFile = async (file: File) => {
		if (!file.type.startsWith('image/')) {
			uploadError = 'Please select a valid image file.';
			return;
		}
		if (file.size > 15 * 1024 * 1024) {
			uploadError = 'File size exceeds 15MB limit.';
			return;
		}

		uploadError = null;
		isUploading = true;
		uploadSuccessUrl = null;
		
		if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
		thumbnailPreviewUrl = URL.createObjectURL(file);

		// DEMO MODE MOCK
		if (isDemo) {
			await new Promise(r => setTimeout(r, 1500)); // simulate delay
			isUploading = false;
			uploadSuccessUrl = 'https://imgapi.avadhya.in/demo/demo_image.png';
			return;
		}

		const result = await uploadToExtUtil({
			file,
			assetType: 'article_inline',
			userId: 1,
			projectId: projectId
		});

		isUploading = false;

		if (result.error) {
			uploadError = result.error;
			thumbnailPreviewUrl = null;
		} else {
			uploadSuccessUrl = result.cdn_url;
			if (window.parent && window.parent !== window) {
				window.parent.postMessage(
					{ type: 'EXT_UTIL_UPLOAD_SUCCESS', url: result.cdn_url, key: result.object_key },
					'*'
				);
			}
		}
	};

	const copyToClipboard = async () => {
		if (!generatedCode) return;
		await navigator.clipboard.writeText(generatedCode);
		copySuccess = true;
		setTimeout(() => copySuccess = false, 2000);
	};

	const resetUpload = () => {
		uploadSuccessUrl = null;
		thumbnailPreviewUrl = null;
		uploadError = null;
		selectedFormat = 'url';
	};
</script>

<div class="w-full h-full min-h-[320px] font-sans flex flex-col antialiased bg-white relative">
	{#if uploadError}
		<div class="absolute top-0 left-0 w-full z-50">
			<div class="bg-red-50 text-red-600 text-xs px-4 py-2 border-b border-red-100 flex items-center justify-between">
				<span>{uploadError}</span>
				<button on:click={() => uploadError = null} class="text-red-400 hover:text-red-600">×</button>
			</div>
		</div>
	{/if}

	{#if uploadSuccessUrl}
		<!-- SUCCESS STATE (Minimalist Vercel-style) -->
		<div class="flex-1 flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden bg-white">
			<div class="p-4 border-b border-gray-100 flex items-start gap-4 bg-gray-50/50">
				<div class="w-20 h-20 rounded border border-gray-200 bg-white overflow-hidden flex-shrink-0 relative group">
					<div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiIvPgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmM2YzZjMiLz4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmM2YzZjMiLz4KPC9zdmc+')] opacity-50"></div>
					{#if thumbnailPreviewUrl}
						<img src={thumbnailPreviewUrl} alt="Preview" class="w-full h-full object-cover relative z-10" />
					{/if}
					<button on:click={resetUpload} class="absolute inset-0 z-20 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
						Reset
					</button>
				</div>
				<div class="flex-1 pt-1">
					<div class="flex items-center gap-2 mb-1">
						<span class="w-2 h-2 rounded-full bg-green-500"></span>
						<h3 class="text-sm font-medium text-gray-900">Upload Complete</h3>
					</div>
					<p class="text-xs text-gray-500 truncate">{uploadSuccessUrl}</p>
				</div>
			</div>

			<div class="flex-1 flex flex-col p-4 bg-white">
				<div class="flex border-b border-gray-200 mb-4">
					{#each ['url', 'html', 'markdown', 'bbcode'] as format}
						<button 
							on:click={() => selectedFormat = format as ExportFormat}
							class="px-4 py-2 text-xs font-medium border-b-2 transition-colors {selectedFormat === format ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}"
						>
							{format.toUpperCase()}
						</button>
					{/each}
				</div>

				{#if selectedFormat === 'html'}
					<div class="flex items-center gap-4 mb-3">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={htmlOptions.rounded} class="w-3.5 h-3.5 rounded-sm border-gray-300 text-black focus:ring-black" />
							<span class="text-xs text-gray-600">Rounded</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={htmlOptions.shadow} class="w-3.5 h-3.5 rounded-sm border-gray-300 text-black focus:ring-black" />
							<span class="text-xs text-gray-600">Shadow</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={htmlOptions.responsive} class="w-3.5 h-3.5 rounded-sm border-gray-300 text-black focus:ring-black" />
							<span class="text-xs text-gray-600">Responsive</span>
						</label>
					</div>
				{/if}

				<div class="relative flex-1 min-h-[80px]">
					<textarea 
						readonly 
						value={generatedCode} 
						class="w-full h-full p-3 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-800 resize-none focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
					></textarea>
					
					<button 
						on:click={copyToClipboard}
						class="absolute bottom-3 right-3 px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 {copySuccess ? 'bg-green-600 hover:bg-green-700' : ''}"
					>
						{#if copySuccess}
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
							Copied
						{:else}
							Copy
						{/if}
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- UPLOAD STATE (Minimalist) -->
		<div
			class="flex-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors
			{isDragging ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'}
			cursor-pointer"
			on:dragover|preventDefault={() => (isDragging = true)}
			on:dragleave|preventDefault={() => (isDragging = false)}
			on:drop={handleDrop}
			role="button"
			tabindex="0"
			on:click={() => !isUploading && fileInput.click()}
			on:keydown={(e) => e.key === 'Enter' && !isUploading && fileInput.click()}
		>
			{#if isUploading}
				<div class="flex flex-col items-center gap-3">
					<svg class="animate-spin h-6 w-6 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
						<path class="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span class="text-xs font-medium text-gray-500">Processing...</span>
				</div>
			{:else}
				<svg class="w-6 h-6 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
				</svg>
				<p class="text-sm font-medium text-gray-900 mb-1">Upload an image</p>
				<p class="text-xs text-gray-500">Drag & drop or click to select</p>
				{#if isDemo}
					<span class="mt-4 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded uppercase">Demo Mode</span>
				{/if}
			{/if}
			<input bind:this={fileInput} on:change={handleFileSelect} type="file" class="hidden" accept="image/png, image/jpeg, image/webp, image/gif, image/avif" />
		</div>
	{/if}
</div>
