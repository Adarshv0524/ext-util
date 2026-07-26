<script lang="ts">
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	let { data, children } = $props();

	// Computed active links
	let currentPath = $derived($page.url.pathname);
	let isAdminPath = $derived(currentPath.startsWith('/admin'));
	
	let mobileMenuOpen = $state(false);
</script>

<div class="flex h-screen w-full bg-zinc-300 text-zinc-900 overflow-hidden">
	
	<!-- Mobile header/nav -->
	<div class="lg:hidden fixed top-0 w-full h-16 bg-zinc-200/90 backdrop-blur border-b border-zinc-400/50 flex items-center justify-between px-4 z-40">
		<div class="font-bold text-xl tracking-tight text-indigo-700">imgapi</div>
		<button onclick={() => mobileMenuOpen = !mobileMenuOpen} class="p-2 -mr-2 text-zinc-600 hover:text-zinc-900">
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}/>
			</svg>
		</button>
	</div>

	<!-- Sidebar -->
	<aside class="
		fixed lg:static top-16 lg:top-0 h-[calc(100vh-4rem)] lg:h-screen w-64 bg-zinc-200 border-r border-zinc-400/50 
		flex flex-col z-30 transition-transform duration-300 ease-in-out
		{mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
	">
		<!-- Branding (Desktop) -->
		<div class="hidden lg:flex h-20 items-center px-8 border-b border-zinc-400/30">
			<span class="font-bold text-2xl tracking-tight text-indigo-700">imgapi</span>
		</div>

		<!-- Nav Links -->
		<div class="flex-1 overflow-y-auto p-4 space-y-8">
			<!-- User Navigation -->
			<div>
				<div class="px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">My Workspace</div>
				<nav class="space-y-1">
					<a href="/dashboard" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors {currentPath === '/dashboard' ? 'bg-indigo-600 text-white' : 'text-zinc-700 hover:bg-zinc-300/50'}">
						<svg class="w-5 h-5 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
						Projects
					</a>
					<a href="/dashboard/images" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors {currentPath.startsWith('/dashboard/images') ? 'bg-indigo-600 text-white' : 'text-zinc-700 hover:bg-zinc-300/50'}">
						<svg class="w-5 h-5 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
						My Images
					</a>
				</nav>
			</div>

			<!-- Admin Navigation -->
			{#if data.user?.role === 'ADMIN'}
				<div>
					<div class="px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
						<svg class="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
						Admin Area
					</div>
					<nav class="space-y-1">
						<a href="/admin" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors {currentPath === '/admin' ? 'bg-zinc-800 text-white' : 'text-zinc-700 hover:bg-zinc-300/50'}">
							Overview
						</a>
						<a href="/admin/users" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors {currentPath.startsWith('/admin/users') ? 'bg-zinc-800 text-white' : 'text-zinc-700 hover:bg-zinc-300/50'}">
							Users
						</a>
						<a href="/admin/projects" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors {currentPath.startsWith('/admin/projects') ? 'bg-zinc-800 text-white' : 'text-zinc-700 hover:bg-zinc-300/50'}">
							All Projects
						</a>
						<a href="/admin/images" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors {currentPath.startsWith('/admin/images') ? 'bg-zinc-800 text-white' : 'text-zinc-700 hover:bg-zinc-300/50'}">
							System Images
						</a>
					</nav>
				</div>
			{/if}
		</div>

		<!-- User Profile Bottom -->
		<div class="p-4 border-t border-zinc-400/30">
			<div class="flex items-center gap-3 px-4 py-3 bg-zinc-300/50 rounded-xl border border-zinc-400/30">
				{#if data.user?.picture}
					<img src={data.user.picture} alt="" class="w-9 h-9 rounded-full border border-zinc-400 shadow-sm" />
				{:else}
					<div class="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
						{data.user?.email?.[0].toUpperCase() || 'U'}
					</div>
				{/if}
				<div class="flex-1 min-w-0">
					<div class="text-sm font-bold text-zinc-900 truncate">{data.user?.name || 'Developer'}</div>
					<div class="text-xs text-zinc-500 truncate">{data.user?.email}</div>
				</div>
			</div>
			
			<div class="mt-4 flex gap-2 px-2">
				<a href="mailto:theawadhilanguage@gmail.com" class="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition flex-1 text-center">Support</a>
				<span class="text-zinc-400">•</span>
				<a href="/docs" target="_blank" class="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition flex-1 text-center">Docs</a>
			</div>
		</div>
	</aside>

	<!-- Main Content Area -->
	<main class="flex-1 flex flex-col h-[calc(100vh-4rem)] lg:h-screen overflow-hidden pt-16 lg:pt-0">
		<div class="flex-1 overflow-y-auto">
			{@render children()}
		</div>
	</main>
</div>

{#if mobileMenuOpen}
	<div 
		class="fixed inset-0 bg-zinc-900/50 z-20 lg:hidden backdrop-blur-sm"
		transition:fade={{duration: 200}}
		onclick={() => mobileMenuOpen = false}
	></div>
{/if}
