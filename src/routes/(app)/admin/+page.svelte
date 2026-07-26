<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<div class="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-zinc-900">Admin Overview</h1>
			<p class="text-zinc-600 mt-2">High-level statistics and quick links for the platform.</p>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<div class="bg-zinc-200/50 p-6 rounded-xl border border-zinc-400/50 shadow-sm">
			<div class="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Total Users</div>
			<div class="text-4xl font-bold text-indigo-700">{data.stats.users}</div>
			<div class="mt-4 pt-4 border-t border-zinc-400/30">
				<a href="/admin/users" class="text-sm font-medium text-zinc-600 hover:text-indigo-600 transition">Manage Users &rarr;</a>
			</div>
		</div>

		<div class="bg-zinc-200/50 p-6 rounded-xl border border-zinc-400/50 shadow-sm">
			<div class="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Total Projects</div>
			<div class="text-4xl font-bold text-emerald-700">{data.stats.projects}</div>
			<div class="mt-4 pt-4 border-t border-zinc-400/30">
				<a href="/admin/projects" class="text-sm font-medium text-zinc-600 hover:text-emerald-600 transition">View Projects &rarr;</a>
			</div>
		</div>

		<div class="bg-zinc-200/50 p-6 rounded-xl border border-zinc-400/50 shadow-sm">
			<div class="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Total Assets Uploaded</div>
			<div class="text-4xl font-bold text-amber-700">{data.stats.images}</div>
			<div class="mt-4 pt-4 border-t border-zinc-400/30">
				<a href="/admin/images" class="text-sm font-medium text-zinc-600 hover:text-amber-600 transition">View System Images &rarr;</a>
			</div>
		</div>
	</div>
</div>
