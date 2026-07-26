<h1>Overview</h1>

<p class="text-lg text-zinc-600 mb-8">
  <strong>imgapi</strong> is an edge-native image handling microservice. It allows your main application to securely offload all binary processing, storage, and bandwidth directly to Cloudflare's edge network.
</p>

<h2>Feature Comparison</h2>
<div class="overflow-x-auto my-6">
  <table class="min-w-full text-left text-sm border-collapse border border-zinc-300">
    <thead class="bg-zinc-200/50">
      <tr>
        <th class="p-3 border-b border-zinc-300 font-bold">Feature</th>
        <th class="p-3 border-b border-zinc-300 font-bold">Traditional Server</th>
        <th class="p-3 border-b border-zinc-300 font-bold text-indigo-700">imgapi (Edge)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="p-3 border-b border-zinc-200">Upload Path</td>
        <td class="p-3 border-b border-zinc-200">Client &rarr; Server &rarr; Storage</td>
        <td class="p-3 border-b border-zinc-200 font-medium">Client &rarr; Storage</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200">Bandwidth Cost</td>
        <td class="p-3 border-b border-zinc-200">High (Billed twice)</td>
        <td class="p-3 border-b border-zinc-200 font-medium">Zero (Direct to R2)</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200">Security</td>
        <td class="p-3 border-b border-zinc-200">Server exposed to malware</td>
        <td class="p-3 border-b border-zinc-200 font-medium">Edge isolates malicious files</td>
      </tr>
      <tr>
        <td class="p-3">Orphan Management</td>
        <td class="p-3">Manual cron jobs</td>
        <td class="p-3 font-medium">Automated D1 Ledgers</td>
      </tr>
    </tbody>
  </table>
</div>

<h2>Integration Options</h2>
<p>Choose the integration path that best fits your technical requirements:</p>

<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
  <div class="border border-zinc-300 rounded-lg p-6 bg-zinc-200/20">
    <h3 class="text-lg font-bold text-zinc-900 m-0 mb-2">1. Widget Integration</h3>
    <p class="text-sm text-zinc-600 m-0 mb-4">Zero-code drag and drop iframe. Ideal for blog editors, SaaS avatars, and rapid deployment.</p>
    <a href="/docs/embed" class="text-indigo-700 font-bold text-sm hover:underline">Read Guide &rarr;</a>
  </div>
  
  <div class="border border-zinc-300 rounded-lg p-6 bg-zinc-200/20">
    <h3 class="text-lg font-bold text-zinc-900 m-0 mb-2">2. Headless API</h3>
    <p class="text-sm text-zinc-600 m-0 mb-4">Full custom UI control. Build your own dropzones utilizing our secure REST endpoints.</p>
    <a href="/docs/api" class="text-indigo-700 font-bold text-sm hover:underline">Read Guide &rarr;</a>
  </div>
</div>
