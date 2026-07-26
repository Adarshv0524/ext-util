<script lang="ts">
	// Main landing page for util.avadhya.in
</script>

<svelte:head>
	<title>ext-util | The Edge-Native Image Microservice</title>
</svelte:head>

<div class="min-h-screen bg-white text-gray-900 font-sans selection:bg-black selection:text-white">
	<!-- Navigation -->
	<nav class="border-b border-gray-100 flex items-center justify-between px-6 py-4">
		<div class="font-bold text-xl tracking-tight flex items-center gap-2">
			<svg class="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>
			</svg>
			ext-util
		</div>
		<div class="flex items-center gap-6 text-sm font-medium">
			<a href="/docs" class="text-gray-500 hover:text-black transition-colors">Documentation</a>
			<a href="https://github.com/avadhya/ext-util" target="_blank" class="text-gray-500 hover:text-black transition-colors">GitHub</a>
			<a href="/docs/quickstart" class="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors">Get Started</a>
		</div>
	</nav>

	<!-- Hero Section -->
	<section class="max-w-6xl mx-auto px-6 pt-24 pb-20">
		<div class="grid md:grid-cols-2 gap-16 items-center">
			
			<!-- Copy -->
			<div class="space-y-8">
				<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold tracking-wide uppercase border border-green-200">
					<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
					v1.0 is live at Edge
				</div>
				<h1 class="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-black">
					The ultimate <br/><span class="text-gray-400">image utility</span> <br/>for your apps.
				</h1>
				<p class="text-lg text-gray-500 leading-relaxed max-w-md">
					A decoupled, high-performance microservice that securely handles image uploads directly to Cloudflare R2. Zero dependencies. Total control.
				</p>
				<div class="flex items-center gap-4">
					<a href="/docs" class="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl">
						Read the Docs
					</a>
					<a href="#features" class="px-6 py-3 bg-white text-black font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
						View Features
					</a>
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
						title="ext-util upload card demo"
					></iframe>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section id="features" class="border-t border-gray-100 bg-gray-50 py-24">
		<div class="max-w-6xl mx-auto px-6">
			<div class="grid md:grid-cols-3 gap-12">
				
				<div class="space-y-4">
					<div class="w-12 h-12 bg-white rounded-xl border border-gray-200 flex items-center justify-center shadow-sm">
						<svg class="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
					</div>
					<h3 class="text-xl font-bold">Edge Native</h3>
					<p class="text-gray-500 leading-relaxed text-sm">
						Uploads stream directly from the user's browser into Cloudflare R2 object storage at the network edge, bypassing any middleman servers.
					</p>
				</div>

				<div class="space-y-4">
					<div class="w-12 h-12 bg-white rounded-xl border border-gray-200 flex items-center justify-center shadow-sm">
						<svg class="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
					</div>
					<h3 class="text-xl font-bold">Secure Validation</h3>
					<p class="text-gray-500 leading-relaxed text-sm">
						Your main app never touches the binary. Ext-util handles magic-byte verification, MIME type checking, and HMAC token validation natively.
					</p>
				</div>

				<div class="space-y-4">
					<div class="w-12 h-12 bg-white rounded-xl border border-gray-200 flex items-center justify-center shadow-sm">
						<svg class="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
					</div>
					<h3 class="text-xl font-bold">Image Organization</h3>
					<p class="text-gray-500 leading-relaxed text-sm">
						Organize images into structured project folders instantly. Easily retrieve or manage assets based on tenant, user, or category natively.
					</p>
				</div>

			</div>
		</div>
	</section>

	<footer class="border-t border-gray-100 py-12 text-center">
		<p class="text-sm font-medium text-gray-400">&copy; {new Date().getFullYear()} Avadhya. The Ext-Util Microservice.</p>
	</footer>
</div>
