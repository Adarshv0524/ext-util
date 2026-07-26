<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	function copyToClipboard(url: string) {
		navigator.clipboard.writeText(url);
		alert('URL copied to clipboard!');
	}
</script>

<div class="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-zinc-900">System Images</h1>
			<p class="text-zinc-600 mt-2">View all images uploaded across the platform (showing latest 200).</p>
		</div>
	</div>

	{#if !data.images || data.images.length === 0}
		<div class="text-center py-16 bg-zinc-200/30 rounded-xl border border-zinc-400/30 border-dashed">
			<p class="text-zinc-500">No images have been uploaded yet.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			{#each data.images as image}
				<div class="bg-zinc-200/50 rounded-xl border border-zinc-400/50 shadow-sm overflow-hidden flex flex-col">
					<!-- Image Preview -->
					<div class="h-48 w-full bg-zinc-800 flex items-center justify-center relative group">
						{#if image.asset_type.startsWith('image')}
							<img src={image.public_url} alt="Upload" class="w-full h-full object-cover transition duration-300 group-hover:opacity-75" />
						{:else}
							<div class="text-zinc-400">
								<svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
								{image.asset_type}
							</div>
						{/if}
						<button 
							onclick={() => copyToClipboard(image.public_url)}
							class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 bg-black/40 text-white font-bold backdrop-blur-sm"
						>
							Copy URL
						</button>
					</div>
					
					<!-- Details -->
					<div class="p-4 flex-1 flex flex-col justify-between">
						<div>
							<div class="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Key</div>
							<div class="text-sm text-zinc-900 font-mono break-all line-clamp-2" title={image.r2_object_key}>
								{image.r2_object_key}
							</div>
						</div>
						
						<div class="mt-4 pt-4 border-t border-zinc-400/30 flex items-center justify-between">
							<div>
								<div class="text-xs font-bold text-zinc-900">{image.uploader_name || 'Unknown'}</div>
								<div class="text-xs text-zinc-500">{image.uploader_email}</div>
							</div>
							<div class="px-2 py-1 rounded bg-zinc-300/50 border border-zinc-400/30 text-xs text-zinc-500">
								{image.is_committed ? 'Committed' : 'Temporary'}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
