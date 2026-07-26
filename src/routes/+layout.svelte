<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
	<header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-indigo-500/20">
					EU
				</div>
				<span class="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-300 via-purple-300 to-emerald-300 bg-clip-text text-transparent">
					ext-util microservice
				</span>
			</div>
			<div class="flex items-center gap-4 text-xs font-medium text-slate-400">
				<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
					Cloudflare Edge Operational
				</span>
			</div>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-slate-950">
		ext-util Decoupled Image Handling Microservice &bull; SvelteKit + Cloudflare R2 / KV / D1
	</footer>
</div>
