<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>imgapi | The Edge-Native Image Microservice</title>
</svelte:head>

<div class="min-h-screen bg-transparent text-zinc-900 font-sans selection:bg-indigo-600 selection:text-white relative z-10">
	<!-- Navigation -->
	<nav class="border-b border-zinc-400/30 flex items-center justify-between px-6 py-4 backdrop-blur-sm">
		<div class="font-bold text-xl tracking-tight flex items-center gap-2 text-zinc-900">
			<svg class="w-6 h-6 text-indigo-700" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
			</svg>
			imgapi
		</div>
		<div class="flex items-center gap-6 text-sm font-medium">
			<a href="/docs" class="text-zinc-600 hover:text-zinc-900 transition-colors">Documentation</a>
			<a href="https://github.com/Adarshv0524/imgapi" target="_blank" class="text-zinc-600 hover:text-zinc-900 transition-colors">GitHub</a>
			{#if data.user}
				<a href="/dashboard" class="px-4 py-2 bg-zinc-200 text-zinc-900 rounded-md hover:bg-zinc-300 transition-colors shadow-sm font-semibold">Dashboard</a>
			{:else}
				<a href="/login/google" class="px-4 py-2 bg-indigo-700 text-white rounded-md hover:bg-indigo-800 transition-colors shadow-sm">Login</a>
			{/if}
		</div>
	</nav>

	<!-- Hero Section -->
	<section class="max-w-6xl mx-auto px-6 pt-24 pb-20">
		<div class="grid md:grid-cols-2 gap-16 items-center">
			
			<!-- Copy -->
			<div class="space-y-8">
				<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold tracking-wide uppercase border border-indigo-200 shadow-sm">
					<span class="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
					v1.0 is live at Edge
				</div>
				<h1 class="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-zinc-900">
					The ultimate <br/><span class="text-zinc-600">image utility</span> <br/>for your apps.
				</h1>
				<p class="text-lg text-zinc-700 leading-relaxed max-w-md">
					A decoupled, high-performance microservice that securely handles image uploads directly to Cloudflare R2. Zero dependencies. Total control.
				</p>
				<div class="flex items-center gap-4">
					<a href="/docs" class="px-6 py-3 bg-indigo-700 text-white font-medium rounded-lg hover:bg-indigo-800 transition-all shadow-md">
						Read the Docs
					</a>
					<button onclick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} class="px-6 py-3 bg-zinc-200/50 text-zinc-900 font-medium border border-zinc-400/50 rounded-lg hover:bg-zinc-200 transition-colors shadow-sm">
						View Features
					</button>
				</div>
			</div>

			<!-- Live Demo Widget -->
			<div class="relative w-full max-w-md mx-auto xl:mr-0 aspect-[4/3] md:aspect-auto md:h-[420px]">
				<div class="absolute inset-0 bg-gradient-to-tr from-gray-100 to-gray-50 rounded-2xl transform rotate-3 scale-105 border border-gray-200"></div>
				<div class="absolute inset-0 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
					<div class="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
						<div class="flex gap-1.5">
							<div class="w-3 h-3 rounded-full bg-red-400"></div>
							<div class="w-3 h-3 rounded-full bg-yellow-400"></div>
							<div class="w-3 h-3 rounded-full bg-green-400"></div>
						</div>
						<span class="text-[10px] font-mono text-gray-400 ml-2">Live Demo Mode</span>
					</div>
					<!-- EMBED THE WIDGET -->
					<iframe 
						src="/upload-card?demo=true&project_id=demo_project&rounded=true" 
						class="w-full flex-1" 
						title="imgapi upload card demo"
					></iframe>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section id="features" class="border-t border-zinc-400/30 bg-zinc-400/10 py-24">
		<div class="max-w-6xl mx-auto px-6">
			<div class="grid md:grid-cols-3 gap-12">
				
				<div class="space-y-4">
					<div class="w-12 h-12 bg-zinc-200/50 rounded-xl border border-zinc-400/50 flex items-center justify-center shadow-sm">
						<svg class="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
					</div>
					<h3 class="text-xl font-bold text-zinc-900">Edge Native</h3>
					<p class="text-zinc-700 leading-relaxed text-sm">
						Uploads stream directly from the user's browser into Cloudflare R2 object storage at the network edge, bypassing any middleman servers.
					</p>
				</div>

				<div class="space-y-4">
					<div class="w-12 h-12 bg-zinc-200/50 rounded-xl border border-zinc-400/50 flex items-center justify-center shadow-sm">
						<svg class="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
					</div>
					<h3 class="text-xl font-bold text-zinc-900">Secure Validation</h3>
					<p class="text-zinc-700 leading-relaxed text-sm">
						Your main app never touches the binary. Imgapi handles magic-byte verification, MIME type checking, and HMAC token validation natively.
					</p>
				</div>

				<div class="space-y-4">
					<div class="w-12 h-12 bg-zinc-200/50 rounded-xl border border-zinc-400/50 flex items-center justify-center shadow-sm">
						<svg class="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
					</div>
					<h3 class="text-xl font-bold text-zinc-900">Image Organization</h3>
					<p class="text-zinc-700 leading-relaxed text-sm">
						Organize images into structured project folders instantly. Easily retrieve or manage assets based on tenant, user, or category natively.
					</p>
				</div>

			</div>
		</div>
	</section>

	<footer class="border-t border-zinc-400/30 py-12 text-center">
		<p class="text-sm font-medium text-zinc-600">&copy; {new Date().getFullYear()} Avadhya. The ImgAPI Microservice.</p>
	</footer>
</div>
