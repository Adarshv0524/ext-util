<script lang="ts">
	import { ALLOWED_MIME_TYPES, ASSET_SIZE_LIMITS } from '$lib/constants';
	
	// Create an array for the view
	const limits = Object.entries(ASSET_SIZE_LIMITS).map(([key, value]) => ({
		type: key,
		size: value / (1024 * 1024)
	}));

	const mimes = Array.from(ALLOWED_MIME_TYPES).map(m => m.replace('image/', ''));
</script>

<div class="min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-blue-100">
	<div class="max-w-4xl mx-auto px-6 py-16 space-y-16">
		
		<!-- Header -->
		<header class="space-y-4">
			<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100">
				<span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
				API Operational
			</div>
			<h1 class="text-4xl font-semibold tracking-tight text-gray-900">util.avadhya.in</h1>
			<p class="text-lg text-gray-500 max-w-2xl leading-relaxed">
				External Image Utility Microservice. Handles cross-origin image uploads, direct-to-edge binary streaming, and format validation for the Avadhya ecosystem.
			</p>
		</header>

		<!-- Integration Guide -->
		<section class="space-y-6">
			<h2 class="text-2xl font-semibold tracking-tight border-b border-gray-200 pb-2">Integration Methods</h2>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Iframe Method -->
				<div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
					<h3 class="font-semibold text-gray-900">1. Embeddable Upload Widget</h3>
					<p class="text-sm text-gray-500">Drop-in iframe widget that handles the upload UI and sends the CDN URL back via `postMessage`.</p>
					
					<div class="bg-gray-50 rounded-lg p-4 border border-gray-100 overflow-x-auto text-xs font-mono text-gray-700 whitespace-pre">
&lt;iframe 
  src="https://util.avadhya.in/upload-card" 
  width="100%" 
  height="300" 
  frameborder="0"&gt;
&lt;/iframe&gt;

&lt;script&gt;
window.addEventListener('message', (e) =&gt; &#123;
  if (e.data?.type === 'EXT_UTIL_UPLOAD_SUCCESS') &#123;
    console.log("Uploaded URL:", e.data.url);
  &#125;
&#125;);
&lt;/script&gt;
					</div>
					<a href="/upload-card" target="_blank" class="inline-block text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">Preview Widget &rarr;</a>
				</div>

				<!-- Headless API Method -->
				<div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
					<h3 class="font-semibold text-gray-900">2. Headless API Client</h3>
					<p class="text-sm text-gray-500">Directly integrate the upload function into your own UI or Tiptap editor extension.</p>
					
					<div class="bg-gray-50 rounded-lg p-4 border border-gray-100 overflow-x-auto text-xs font-mono text-gray-700 whitespace-pre">
import &#123; uploadToExtUtil &#125; from './media-client';

const result = await uploadToExtUtil(&#123;
  file: imageFile,
  assetType: 'article_inline',
  userId: 123
&#125;);

if (!result.error) &#123;
  console.log("CDN URL:", result.cdn_url);
&#125;
					</div>
				</div>
			</div>
		</section>

		<!-- Configuration & Limits -->
		<section class="space-y-6">
			<h2 class="text-2xl font-semibold tracking-tight border-b border-gray-200 pb-2">Constraints & Attributes</h2>
			
			<div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
				<div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
					<!-- Mime Types -->
					<div class="p-6">
						<h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Supported Formats</h3>
						<div class="flex flex-wrap gap-2">
							{#each mimes as mime}
								<span class="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md border border-gray-200">
									.{mime}
								</span>
							{/each}
						</div>
					</div>
					
					<!-- Size Limits -->
					<div class="p-6">
						<h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Size Caps by Asset Type</h3>
						<ul class="space-y-3 text-sm">
							{#each limits as limit}
								<li class="flex items-center justify-between">
									<span class="font-mono text-gray-600">{limit.type}</span>
									<span class="font-medium text-gray-900">{limit.size} MB</span>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		</section>

		<footer class="pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
			util.avadhya.in &copy; {new Date().getFullYear()} &mdash; Centralized Media Processing
		</footer>
	</div>
</div>
