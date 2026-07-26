<script lang="ts">
	let { data, children } = $props();
	import { page } from '$app/stores';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

	const nav = [
		{ name: 'Overview', href: '/docs' },
		{ name: 'Widget Integration', href: '/docs/embed' },
		{ name: 'Headless API', href: '/docs/api' },
		{ name: 'Folder Organization', href: '/docs/organization' }
	];

	let currentIndex = $derived(nav.findIndex(item => item.href === $page.url.pathname));
	let prevPage = $derived(currentIndex > 0 ? nav[currentIndex - 1] : null);
	let nextPage = $derived(currentIndex < nav.length - 1 ? nav[currentIndex + 1] : null);
	let currentPage = $derived(nav[currentIndex] || nav[0]);
</script>

<div class="min-h-screen bg-transparent text-zinc-900 font-sans flex flex-col relative z-10 selection:bg-indigo-600 selection:text-white">
	<!-- Docs Header -->
	<header class="border-b border-zinc-400/30 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-300/80 backdrop-blur-md z-50">
		<a href="/" class="font-bold text-lg tracking-tight flex items-center gap-2 text-zinc-900 hover:text-indigo-700 transition-colors">
			<svg class="w-5 h-5 text-indigo-700" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
			</svg>
			imgapi docs
		</a>
		<div class="flex items-center gap-4 text-sm font-medium">
			{#if data.user}
				<a href="/dashboard" class="px-4 py-2 bg-zinc-200 text-zinc-900 rounded-md hover:bg-zinc-300 transition-colors shadow-sm font-semibold">Dashboard</a>
			{:else}
				<a href="/login/google" class="px-4 py-2 bg-indigo-700 text-white rounded-md hover:bg-indigo-800 transition-colors shadow-sm">Login</a>
			{/if}
		</div>
	</header>

	<div class="flex-1 max-w-6xl w-full mx-auto flex flex-col md:flex-row">
		<!-- Sidebar Navigation -->
		<aside class="w-full md:w-64 flex-shrink-0 border-r border-zinc-400/30 p-6">
			<nav class="space-y-1">
				{#each nav as item}
					<a 
						href={item.href}
						class="block px-3 py-2 rounded-md text-sm font-medium transition-colors {$page.url.pathname === item.href ? 'bg-indigo-600/10 text-indigo-700' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-400/10'}"
					>
						{item.name}
					</a>
				{/each}
			</nav>
		</aside>

		<!-- Main Content -->
		<main class="flex-1 p-6 md:p-12 max-w-3xl">
			
			<!-- Breadcrumbs -->
			<Breadcrumbs items={[
				{ name: 'Docs', href: '/docs' },
				{ name: currentPage.name }
			]} />

			<div class="prose prose-sm sm:prose-base max-w-none">
				{@render children()}
			</div>

			<!-- Next / Prev Navigation -->
			<div class="mt-16 pt-8 border-t border-zinc-400/30 flex items-center justify-between">
				<div>
					{#if prevPage}
						<a href={prevPage.href} class="group flex flex-col items-start gap-1">
							<span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Previous</span>
							<span class="text-indigo-700 font-medium group-hover:text-indigo-600 transition-colors">&larr; {prevPage.name}</span>
						</a>
					{/if}
				</div>
				<div>
					{#if nextPage}
						<a href={nextPage.href} class="group flex flex-col items-end gap-1">
							<span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Next</span>
							<span class="text-indigo-700 font-medium group-hover:text-indigo-600 transition-colors">{nextPage.name} &rarr;</span>
						</a>
					{/if}
				</div>
			</div>

		</main>
	</div>
</div>

<style>
	/* Basic prose styles for markdown-like content in mid-grey theme */
	:global(.prose h1) { font-size: 2.25rem; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 1.5rem; color: #18181b; }
	:global(.prose h2) { font-size: 1.5rem; font-weight: 700; border-bottom: 1px solid rgba(161, 161, 170, 0.3); padding-bottom: 0.5rem; margin-top: 2rem; margin-bottom: 1rem; color: #27272a; }
	:global(.prose h3) { font-size: 1.125rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #3f3f46; }
	:global(.prose p) { color: #52525b; line-height: 1.75; margin-bottom: 1.25rem; }
	:global(.prose code:not(pre code)) { background-color: rgba(228, 228, 231, 0.8); padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.875em; color: #4338ca; font-weight: 500; border: 1px solid rgba(161, 161, 170, 0.3); }
	:global(.prose pre) { background-color: #18181b; border: 1px solid rgba(161, 161, 170, 0.5); color: #e4e4e7; padding: 1.25rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
	:global(.prose ul) { list-style-type: disc; padding-left: 1.5rem; color: #52525b; margin-bottom: 1.25rem; }
	:global(.prose li) { margin-bottom: 0.5rem; }
	:global(.prose a) { color: #4f46e5; font-weight: 500; text-decoration: none; transition: color 0.2s; }
	:global(.prose a:hover) { color: #4338ca; text-decoration: underline; }
	:global(.prose strong) { color: #18181b; font-weight: 600; }
</style>
