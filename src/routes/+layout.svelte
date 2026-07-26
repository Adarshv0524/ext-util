<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<main class="w-full h-full min-h-screen bg-transparent">
	{@render children()}
</main>
