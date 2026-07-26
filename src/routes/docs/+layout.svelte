<script lang="ts">
	import { page } from '$app/stores';

	const nav = [
		{ name: 'Overview', href: '/docs' },
		{ name: 'Quickstart', href: '/docs/quickstart' },
		{ name: 'Embed Widget', href: '/docs/embed' },
		{ name: 'API Reference', href: '/docs/api' },
		{ name: 'Image Organization', href: '/docs/organization' }
	];
</script>

<div class="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
	<!-- Docs Header -->
	<header class="border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-50">
		<a href="/" class="font-bold text-lg tracking-tight flex items-center gap-2 hover:opacity-80">
			<svg class="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
			</svg>
			ext-util docs
		</a>
	</header>

	<div class="flex-1 max-w-6xl w-full mx-auto flex flex-col md:flex-row">
		<!-- Sidebar Navigation -->
		<aside class="w-full md:w-64 flex-shrink-0 border-r border-gray-100 p-6">
			<nav class="space-y-1">
				{#each nav as item}
					<a 
						href={item.href}
						class="block px-3 py-2 rounded-md text-sm font-medium transition-colors {$page.url.pathname === item.href ? 'bg-gray-100 text-black' : 'text-gray-500 hover:text-black hover:bg-gray-50'}"
					>
						{item.name}
					</a>
				{/each}
			</nav>
		</aside>

		<!-- Main Content -->
		<main class="flex-1 p-6 md:p-12 prose prose-sm sm:prose-base prose-gray max-w-3xl">
			<slot />
		</main>
	</div>
</div>

<style>
	/* Basic prose styles for markdown-like content */
	:global(.prose h1) { font-size: 2.25rem; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 1.5rem; }
	:global(.prose h2) { font-size: 1.5rem; font-weight: 700; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.5rem; margin-top: 2rem; margin-bottom: 1rem; }
	:global(.prose h3) { font-size: 1.125rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
	:global(.prose p) { color: #4b5563; line-height: 1.75; margin-bottom: 1.25rem; }
	:global(.prose code:not(pre code)) { background-color: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.875em; color: #111827; }
	:global(.prose pre) { background-color: #111827; color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem; }
	:global(.prose ul) { list-style-type: disc; padding-left: 1.5rem; color: #4b5563; margin-bottom: 1.25rem; }
	:global(.prose li) { margin-bottom: 0.5rem; }
	:global(.prose a) { color: #000; font-weight: 500; text-decoration: underline; }
</style>
