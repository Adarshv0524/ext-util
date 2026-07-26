<script lang="ts">
	import { uploadToExtUtil } from '$lib/client/media-client';

	let fileInput: HTMLInputElement;
	let isDragging = false;
	let isUploading = false;
	let uploadError: string | null = null;
	let uploadSuccessUrl: string | null = null;

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
		// Basic client-side validation
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

		const result = await uploadToExtUtil({
			file,
			assetType: 'article_inline',
			userId: 1 // Default or can be passed via URL params
		});

		isUploading = false;

		if (result.error) {
			uploadError = result.error;
		} else {
			uploadSuccessUrl = result.cdn_url;
			
			// Post message back to parent window
			if (window.parent && window.parent !== window) {
				window.parent.postMessage(
					{ type: 'EXT_UTIL_UPLOAD_SUCCESS', url: result.cdn_url, key: result.object_key },
					'*'
				);
			}
		}
	};
</script>

<div class="w-full h-full bg-transparent flex flex-col">
	<div
		class="relative flex flex-col items-center justify-center w-full h-full min-h-[200px] border-2 border-dashed rounded-xl transition-all duration-200
		{isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 bg-gray-50/30 hover:bg-gray-50/80 hover:border-gray-300'}"
		on:dragover|preventDefault={() => (isDragging = true)}
		on:dragleave|preventDefault={() => (isDragging = false)}
		on:drop={handleDrop}
		role="button"
		tabindex="0"
		on:click={() => fileInput.click()}
		on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
	>
		{#if isUploading}
			<div class="flex flex-col items-center space-y-3">
				<svg class="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<span class="text-xs font-medium text-gray-500 tracking-wide uppercase">Uploading</span>
			</div>
		{:else if uploadSuccessUrl}
			<div class="flex flex-col items-center space-y-2 animate-in fade-in zoom-in duration-300">
				<div class="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mb-1">
					<svg class="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<span class="text-sm font-medium text-gray-700">Upload Complete</span>
			</div>
		{:else}
			<svg class="w-8 h-8 mb-3 text-gray-400 transition-transform group-hover:scale-110 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
			</svg>
			<p class="mb-1 text-sm text-gray-600"><span class="font-medium text-blue-600">Click to upload</span> or drag and drop</p>
			<p class="text-[11px] text-gray-400 font-medium">PNG, JPG, WEBP, AVIF (Max 15MB)</p>
		{/if}

		<input 
			bind:this={fileInput}
			on:change={handleFileSelect}
			type="file" 
			class="hidden" 
			accept="image/png, image/jpeg, image/webp, image/gif, image/avif" 
		/>
	</div>

	<!-- Error Feedback -->
	{#if uploadError}
		<div class="mt-3 p-3 bg-red-50/50 text-red-600 text-xs rounded-lg border border-red-100/50 text-center animate-in fade-in slide-in-from-top-2">
			{uploadError}
		</div>
	{/if}

	<!-- Success Feedback (Copy Link) -->
	{#if uploadSuccessUrl}
		<div class="mt-3 flex items-center gap-2 p-1.5 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in slide-in-from-top-2">
			<input type="text" readonly value={uploadSuccessUrl} class="flex-1 text-xs p-2 bg-transparent text-gray-500 focus:outline-none" />
			<button 
				on:click={() => uploadSuccessUrl && navigator.clipboard.writeText(uploadSuccessUrl)}
				class="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 text-xs font-medium rounded-md transition-all shadow-sm"
			>
				Copy
			</button>
		</div>
	{/if}
</div>
