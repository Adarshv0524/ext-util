<h1>Quickstart</h1>

<p>Get <strong>ext-util</strong> running locally in under 5 minutes.</p>

<h2>Prerequisites</h2>
<ul>
  <li>Node.js (v18+)</li>
  <li>A Cloudflare account (for deploying to production)</li>
</ul>

<h2>1. Installation</h2>
<pre><code>git clone https://github.com/avadhya/ext-util.git
cd ext-util
npm install</code></pre>

<h2>2. Environment Setup</h2>
<p>Create a <code>.env</code> file in the root directory and copy the contents from <code>.env.example</code>. Set a secure <code>HMAC_SECRET</code>.</p>
<pre><code># .env
HMAC_SECRET="your_super_secret_random_string"
CDN_BASE_URL="http://localhost:5173"
</code></pre>

<h2>3. Initialize Local Databases</h2>
<p>Ext-util uses Cloudflare D1 for ledgers. Initialize the local SQLite database:</p>
<pre><code>npx wrangler d1 execute ext-util-ledger --local --file=./migrations/schema.sql</code></pre>

<h2>4. Start the Development Server</h2>
<pre><code>npm run dev</code></pre>

<p>Your microservice is now running at <code>http://localhost:5173</code>. You can test the widget by visiting the <a href="/">demo page</a>.</p>

<div class="mt-8 flex gap-4">
  <a href="/docs/embed" class="inline-block px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 transition-colors">Learn how to embed &rarr;</a>
</div>
