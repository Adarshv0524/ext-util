<script lang="ts">
	let { items = [] }: { items: { name: string, href?: string }[] } = $props();
</script>

<nav class="flex text-sm font-medium text-zinc-500 mb-6" aria-label="Breadcrumb">
	<ol class="inline-flex items-center space-x-1 md:space-x-3">
		{#each items as item, i}
			<li class="inline-flex items-center">
				{#if i > 0}
					<svg class="w-4 h-4 text-zinc-400 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				{/if}
				{#if item.href && i !== items.length - 1}
					<a href={item.href} class="inline-flex items-center text-zinc-600 hover:text-indigo-700 transition-colors">
						{item.name}
					</a>
				{:else}
					<span class="inline-flex items-center text-zinc-900 font-semibold">
						{item.name}
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
