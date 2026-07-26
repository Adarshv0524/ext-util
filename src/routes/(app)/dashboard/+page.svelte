<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { fade } from 'svelte/transition';

	export let data: PageData;

	let creating = false;
	let visibleSecrets: Record<string, boolean> = {};

	function toggleSecret(id: string) {
		visibleSecrets[id] = !visibleSecrets[id];
	}
</script>

<div class="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-zinc-900">Your Projects</h1>
			<p class="text-zinc-600 mt-2">Manage your imgapi projects and API secrets.</p>
		</div>
		<button on:click={() => creating = !creating} class="px-4 py-2 bg-indigo-700 text-white text-sm font-bold rounded-lg shadow hover:bg-indigo-800 transition">
			+ New Project
		</button>
	</div>

	{#if creating}
		<form method="POST" action="?/createProject" use:enhance={() => {
			return async ({ update }) => {
				await update();
				creating = false;
			};
		}} class="bg-zinc-200/50 p-6 rounded-xl border border-zinc-400/50 shadow-sm" transition:fade>
			<h3 class="font-bold text-zinc-900 mb-4">Create New Project</h3>
			<div class="flex gap-4">
				<input type="text" name="name" placeholder="e.g. My Awesome App" class="flex-1 bg-white border border-zinc-300 text-zinc-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5" required>
				<button type="submit" class="px-6 py-2 bg-zinc-800 text-white font-bold rounded-lg hover:bg-zinc-700 transition">Create</button>
			</div>
		</form>
	{/if}

	{#if data.projects.length === 0}
		<div class="text-center py-16 bg-zinc-200/30 rounded-xl border border-zinc-400/30 border-dashed">
			<p class="text-zinc-500">You don't have any projects yet.</p>
		</div>
	{:else}
		<div class="grid gap-6">
			{#each data.projects as project}
				<div class="bg-zinc-200/50 rounded-xl border border-zinc-400/50 p-6 shadow-sm flex flex-col md:flex-row gap-6 md:items-center justify-between">
					<div>
						<h3 class="text-xl font-bold text-zinc-900">{project.name}</h3>
						<div class="mt-2 text-sm text-zinc-600 font-mono">
							<span class="text-zinc-500 uppercase text-xs tracking-wider font-sans mr-2">Slug</span>
							{project.project_slug}
						</div>
						<div class="mt-4 text-xs text-zinc-500">
							Created on {new Date(project.created_at).toLocaleDateString()}
						</div>
					</div>
					
					<div class="bg-white p-4 rounded-lg border border-zinc-300 w-full md:w-auto">
						<div class="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">HMAC Secret</div>
						<div class="flex items-center gap-3">
							<code class="px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded text-sm text-indigo-700 font-mono select-all">
								{visibleSecrets[project.id] ? project.hmac_secret : '••••••••••••••••••••••••••••••••••••••••'}
							</code>
							<button on:click={() => toggleSecret(project.id)} class="text-zinc-500 hover:text-zinc-900 transition" title="Toggle visibility">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									{#if visibleSecrets[project.id]}
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
									{:else}
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
									{/if}
								</svg>
							</button>
						</div>
						
						<form method="POST" action="?/regenerateSecret" use:enhance class="mt-3" on:submit={(e) => {
							if(!confirm('Are you sure? This will break any existing uploads using the old secret!')) e.preventDefault();
						}}>
							<input type="hidden" name="projectId" value={project.id} />
							<button type="submit" class="text-xs text-red-600 hover:text-red-700 font-medium transition">
								Regenerate Secret...
							</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
