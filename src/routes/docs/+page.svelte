<h1>Overview</h1>

<p>
  <strong>ext-util</strong> is a decoupled, edge-native image handling microservice. It allows your main application to securely offload all binary processing, storage, and bandwidth to Cloudflare's edge network.
</p>

<h2>Why use a separate microservice?</h2>
<ul>
  <li><strong>Decoupling:</strong> Keep your main application lightweight. You don't need to parse multi-part forms or handle large binary payloads.</li>
  <li><strong>Edge Performance:</strong> Images are uploaded directly from the user's browser to Cloudflare R2 object storage, providing zero-latency ingest.</li>
  <li><strong>Security:</strong> Malicious files never hit your core servers. Magic-byte verification and HMAC signature validation happen natively on the edge.</li>
  <li><strong>Zero Maintenance:</strong> Orphaned images (when a user aborts an upload) are automatically purged via Cloudflare D1 ledgers and Cron triggers.</li>
</ul>

<h2>How it works (The 3-Phase Protocol)</h2>
<ol>
  <li><strong>Phase 1 (Tokenization):</strong> The client requests an upload token. The server validates size/MIME limits and issues a short-lived, HMAC-SHA256 signed token.</li>
  <li><strong>Phase 2 (Streaming):</strong> The client streams the raw binary directly to the Edge URL. The edge verifies the token signature and stores the file in R2.</li>
  <li><strong>Phase 3 (Commitment):</strong> Once the image is attached to a database record (e.g. saving an article), the main app confirms the upload, protecting it from auto-cleanup.</li>
</ol>

<div class="mt-8">
  <a href="/docs/quickstart" class="inline-block px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 transition-colors">Go to Quickstart &rarr;</a>
</div>
