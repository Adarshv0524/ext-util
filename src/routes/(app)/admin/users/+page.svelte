<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

	export let data: PageData;
</script>

<div class="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
	<Breadcrumbs items={[{ name: 'Admin', href: '/admin' }, { name: 'Manage Users' }]} />

	<!-- Header & Settings -->
	<div class="flex flex-col lg:flex-row gap-6 lg:items-start justify-between">
		<div>
			<h1 class="text-3xl font-bold text-zinc-900">Manage Users</h1>
			<p class="text-zinc-600 mt-2">Manage developer access and system settings.</p>
		</div>
		
		<div class="flex flex-col gap-4 md:min-w-[320px]">
			<div class="bg-white p-4 rounded-xl border border-zinc-300 flex items-center gap-4 shadow-sm w-full">
				<div class="flex-1">
					<h3 class="font-bold text-sm text-zinc-900">Auto-Approve Users</h3>
					<p class="text-xs text-zinc-600">New signups bypass the waiting list</p>
				</div>
				<form method="POST" action="?/toggleAutoApprove" use:enhance>
					<input type="hidden" name="autoApprove" value={!data.autoApprove ? 'true' : 'false'} />
					<button type="submit" aria-label="Toggle auto-approve" class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {data.autoApprove ? 'bg-indigo-600' : 'bg-zinc-400'}">
						<span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {data.autoApprove ? 'translate-x-6' : 'translate-x-1'}"></span>
					</button>
				</form>
			</div>

			<form method="POST" action="?/updateNotificationEmails" use:enhance class="bg-white p-4 rounded-xl border border-zinc-300 flex flex-col gap-3 shadow-sm w-full">
				<div>
					<h3 class="font-bold text-sm text-zinc-900">Notification Emails</h3>
					<p class="text-xs text-zinc-600">Comma-separated emails to notify on signup</p>
				</div>
				<div class="flex items-center gap-2">
					<input type="text" name="emails" value={data.notificationEmails} placeholder="admin@example.com" class="flex-1 text-sm bg-zinc-50 border border-zinc-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
					<button type="submit" class="px-3 py-1.5 bg-zinc-800 text-white text-xs font-bold rounded hover:bg-zinc-700 transition">Save</button>
				</div>
			</form>
		</div>
	</div>

	<!-- Users Table -->
	<div class="bg-zinc-200/50 rounded-xl border border-zinc-400/50 overflow-hidden shadow-sm">
		<table class="w-full text-left text-sm">
			<thead class="bg-zinc-300/50 border-b border-zinc-400/30">
				<tr>
					<th class="p-4 font-semibold text-zinc-700">User</th>
					<th class="p-4 font-semibold text-zinc-700">Role</th>
					<th class="p-4 font-semibold text-zinc-700">Status</th>
					<th class="p-4 font-semibold text-zinc-700 text-right">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-zinc-400/30">
				{#each data.users as user}
					<tr class="hover:bg-zinc-300/30 transition-colors">
						<td class="p-4">
							<div class="flex items-center gap-3">
								{#if user.picture}
									<img src={user.picture} alt="" class="w-8 h-8 rounded-full border border-zinc-400" />
								{:else}
									<div class="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">{user.email[0].toUpperCase()}</div>
								{/if}
								<div>
									<div class="font-medium text-zinc-900">{user.name || 'Anonymous'}</div>
									<div class="text-xs text-zinc-500">{user.email}</div>
								</div>
							</div>
						</td>
						<td class="p-4">
							<span class="px-2 py-1 text-xs font-bold rounded-full {user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-800' : 'bg-zinc-300 text-zinc-700'}">
								{user.role}
							</span>
						</td>
						<td class="p-4">
							<span class="px-2 py-1 text-xs font-bold rounded-full {
								user.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 
								user.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 
								'bg-red-100 text-red-800'
							}">
								{user.status}
							</span>
						</td>
						<td class="p-4 text-right">
							{#if user.role !== 'ADMIN'}
								<div class="flex items-center justify-end gap-2">
									{#if user.status !== 'APPROVED'}
										<form method="POST" action="?/updateUserStatus" use:enhance>
											<input type="hidden" name="userId" value={user.id} />
											<input type="hidden" name="status" value="APPROVED" />
											<button class="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 transition">Approve</button>
										</form>
									{/if}
									{#if user.status !== 'BANNED'}
										<form method="POST" action="?/updateUserStatus" use:enhance>
											<input type="hidden" name="userId" value={user.id} />
											<input type="hidden" name="status" value="BANNED" />
											<button class="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition">Ban</button>
										</form>
									{/if}
									{#if user.status !== 'PENDING'}
										<form method="POST" action="?/updateUserStatus" use:enhance>
											<input type="hidden" name="userId" value={user.id} />
											<input type="hidden" name="status" value="PENDING" />
											<button class="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded hover:bg-amber-600 transition">Revoke</button>
										</form>
									{/if}
								</div>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
