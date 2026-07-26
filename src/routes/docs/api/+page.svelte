<h1>Headless API Reference</h1>

<p>If you prefer to build your own custom drag-and-drop UI, you can use the headless API Client provided by imgapi to securely interface with the edge servers.</p>

<h2>Using the Client Library</h2>
<p>In your main application, import the <code>uploadToExtUtil</code> function. You can copy the <code>src/lib/client/media-client.ts</code> file directly into your own project.</p>

<pre><code>import &#123; uploadToExtUtil, commitExtUtilAsset &#125; from './media-client';

async function handleImageDrop(file) &#123;
  const result = await uploadToExtUtil(&#123;
    file: file,
    userId: 123,
    assetType: 'article_inline',
    projectId: 'my_blog_platform',
    apiBaseUrl: 'https://imgapi.avadhya.in'
  &#125;);

  if (result.error) &#123;
    alert("Upload failed: " + result.error);
    return;
  &#125;

  const &#123; object_key, cdn_url &#125; = result;
  console.log("Uploaded! URL:", cdn_url);

  // Phase 3: Commit the asset to prevent orphan cleanup
  await commitExtUtilAsset(object_key, 'articles', articleId, 123, 'https://imgapi.avadhya.in');
&#125;</code></pre>

<h2>REST API Details</h2>
<p>The client library wraps these two core endpoints. Use this reference if you are building your own client from scratch in another language (like Python or Swift).</p>

<div class="overflow-x-auto my-6">
  <table class="min-w-full text-left text-sm border-collapse border border-zinc-300">
    <thead class="bg-zinc-200/50">
      <tr>
        <th class="p-3 border-b border-zinc-300 font-bold">Endpoint</th>
        <th class="p-3 border-b border-zinc-300 font-bold">Method</th>
        <th class="p-3 border-b border-zinc-300 font-bold">Purpose</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">/api/v1/media/upload-token</td>
        <td class="p-3 border-b border-zinc-200"><span class="px-2 py-1 bg-blue-100 text-blue-800 rounded font-bold text-xs">POST</span></td>
        <td class="p-3 border-b border-zinc-200">Requests a short-lived, signed token for an upload.</td>
      </tr>
      <tr>
        <td class="p-3 font-mono text-indigo-700">/upload/[...key]</td>
        <td class="p-3"><span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded font-bold text-xs">PUT</span></td>
        <td class="p-3">Streams the raw binary directly into Cloudflare R2 using the signed token.</td>
      </tr>
    </tbody>
  </table>
</div>
