<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	let pollInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		pollInterval = setInterval(async () => {
			try {
				const res = await fetch('/api/auth/status');
				if (res.ok) {
					const data = await res.json();
					if (data.status === 'APPROVED') {
						goto('/dashboard');
					}
				}
			} catch (e) {
				console.error("Polling error", e);
			}
		}, 5000); // Check every 5 seconds
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});
</script>

<div class="min-h-screen bg-zinc-300 text-zinc-900 flex items-center justify-center p-6">
	<div class="max-w-md w-full bg-zinc-200/50 backdrop-blur-md rounded-2xl p-8 border border-zinc-400/50 shadow-xl text-center">
		<div class="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-6">
			<svg class="w-8 h-8 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
		</div>
		<h1 class="text-2xl font-bold mb-3 text-zinc-900">Waiting for Approval</h1>
		<p class="text-zinc-600 mb-8 leading-relaxed">
			Your developer account has been created. Since imgapi is currently in a restricted beta, an admin must approve your account before you can generate API keys.
		</p>
		<p class="text-sm text-zinc-500">
			You will be notified once your account is active.
		</p>
	</div>
</div>
