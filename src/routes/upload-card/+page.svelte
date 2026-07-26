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

<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
	<div class="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
		<!-- Header -->
		<div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
			<h2 class="text-lg font-semibold text-gray-800">Upload Image</h2>
			<p class="text-sm text-gray-500">Select or drag & drop an image</p>
		</div>

		<!-- Body -->
		<div class="p-6">
			<!-- Dropzone -->
			<div
				class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg transition-colors
				{isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}"
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
						<svg class="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span class="text-sm font-medium text-gray-600">Uploading...</span>
					</div>
				{:else if uploadSuccessUrl}
					<div class="flex flex-col items-center space-y-2">
						<div class="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
							<svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<span class="text-sm font-medium text-green-600">Upload Complete!</span>
					</div>
				{:else}
					<svg class="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
					<p class="mb-2 text-sm text-gray-500"><span class="font-semibold text-blue-600">Click to upload</span> or drag and drop</p>
					<p class="text-xs text-gray-400">PNG, JPG, WEBP, AVIF or GIF (MAX. 15MB)</p>
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
				<div class="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
					{uploadError}
				</div>
			{/if}

			<!-- Success Feedback (Copy Link) -->
			{#if uploadSuccessUrl}
				<div class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
					<p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Image URL</p>
					<div class="flex items-center gap-2">
						<input type="text" readonly value={uploadSuccessUrl} class="flex-1 text-sm p-2 bg-white border border-gray-300 rounded text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
						<button 
							on:click={() => uploadSuccessUrl && navigator.clipboard.writeText(uploadSuccessUrl)}
							class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
						>
							Copy
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
