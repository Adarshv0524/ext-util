<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<div class="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-zinc-900">System Projects</h1>
			<p class="text-zinc-600 mt-2">View all projects created across the platform.</p>
		</div>
	</div>

	<!-- Projects Table -->
	<div class="bg-zinc-200/50 rounded-xl border border-zinc-400/50 overflow-hidden shadow-sm">
		<table class="w-full text-left text-sm">
			<thead class="bg-zinc-300/50 border-b border-zinc-400/30">
				<tr>
					<th class="p-4 font-semibold text-zinc-700">Project Name</th>
					<th class="p-4 font-semibold text-zinc-700">Slug</th>
					<th class="p-4 font-semibold text-zinc-700">Owner</th>
					<th class="p-4 font-semibold text-zinc-700">Created At</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-zinc-400/30">
				{#each data.projects as project}
					<tr class="hover:bg-zinc-300/30 transition-colors">
						<td class="p-4">
							<div class="font-bold text-zinc-900">{project.name}</div>
							<div class="text-xs text-zinc-500 font-mono mt-1">ID: {project.id}</div>
						</td>
						<td class="p-4 font-mono text-zinc-700 text-xs">{project.project_slug}</td>
						<td class="p-4">
							<div class="font-medium text-zinc-900">{project.owner_name || 'Anonymous'}</div>
							<div class="text-xs text-zinc-500">{project.owner_email}</div>
						</td>
						<td class="p-4 text-zinc-600 text-xs">
							{new Date(project.created_at).toLocaleDateString()}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		
		{#if data.projects.length === 0}
			<div class="p-8 text-center text-zinc-500">
				No projects found.
			</div>
		{/if}
	</div>
</div>
