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

<h2>On-The-Fly Image Transformations</h2>
<p class="mb-4">If you're retrieving images, you can apply native Cloudflare Edge resizing simply by passing query parameters to the URL. This allows you to dynamically resize, crop, and optimize images without storing multiple copies.</p>

<div class="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
  <div class="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">Transformation Example</div>
  <code class="text-sm text-indigo-900 break-all">https://imgapi.avadhya.in/upload/my_asset.jpg<span class="font-bold text-pink-600">?w=300&h=300&blur=50&q=80</span></code>
</div>

<div class="overflow-x-auto my-6">
  <table class="min-w-full text-left text-sm border-collapse border border-zinc-300">
    <thead class="bg-zinc-200/50">
      <tr>
        <th class="p-3 border-b border-zinc-300 font-bold w-32">Parameter</th>
        <th class="p-3 border-b border-zinc-300 font-bold">Effect</th>
        <th class="p-3 border-b border-zinc-300 font-bold">Example</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-pink-600">w</td>
        <td class="p-3 border-b border-zinc-200">Sets the maximum width in pixels.</td>
        <td class="p-3 border-b border-zinc-200"><code>w=800</code></td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-pink-600">h</td>
        <td class="p-3 border-b border-zinc-200">Sets the maximum height in pixels.</td>
        <td class="p-3 border-b border-zinc-200"><code>h=600</code></td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-pink-600">q</td>
        <td class="p-3 border-b border-zinc-200">Sets the JPEG/WebP compression quality (1-100).</td>
        <td class="p-3 border-b border-zinc-200"><code>q=75</code></td>
      </tr>
      <tr>
        <td class="p-3 font-mono text-pink-600">blur</td>
        <td class="p-3">Applies a gaussian blur (useful for placeholders).</td>
        <td class="p-3"><code>blur=20</code></td>
      </tr>
    </tbody>
  </table>
</div>

<h2 class="mt-12">Webhook Integration</h2>
<p class="mb-4">You can configure a Webhook URL in your Project Settings via the Dashboard. When an upload is successfully committed, imgapi will instantly fire an asynchronous POST request to your URL.</p>

<!-- Visual Flowchart -->
<div class="flex items-center gap-4 my-8 p-6 bg-zinc-50 rounded-lg border border-zinc-200 overflow-x-auto">
  <div class="flex flex-col items-center flex-shrink-0">
    <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold shadow-sm">1</div>
    <span class="text-xs font-medium mt-2 text-zinc-600">User Uploads</span>
  </div>
  <div class="flex-1 h-0.5 bg-zinc-300 relative min-w-[50px]">
    <div class="absolute right-0 -top-1 w-2.5 h-2.5 border-t-2 border-r-2 border-zinc-300 rotate-45"></div>
  </div>
  <div class="flex flex-col items-center flex-shrink-0">
    <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold shadow-sm">2</div>
    <span class="text-xs font-medium mt-2 text-zinc-600">imgapi Commits</span>
  </div>
  <div class="flex-1 h-0.5 bg-zinc-300 relative min-w-[50px]">
    <div class="absolute right-0 -top-1 w-2.5 h-2.5 border-t-2 border-r-2 border-zinc-300 rotate-45"></div>
    <span class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-2">POST</span>
  </div>
  <div class="flex flex-col items-center flex-shrink-0">
    <div class="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold shadow-sm">3</div>
    <span class="text-xs font-medium mt-2 text-zinc-600">Your Backend API</span>
  </div>
</div>

<h3 class="text-lg font-bold text-zinc-800 mt-8 mb-4">Payload Schema</h3>
<div class="overflow-x-auto mb-6">
  <table class="min-w-full text-left text-sm border-collapse border border-zinc-300">
    <thead class="bg-zinc-200/50">
      <tr>
        <th class="p-3 border-b border-zinc-300 font-bold w-48">Field</th>
        <th class="p-3 border-b border-zinc-300 font-bold w-24">Type</th>
        <th class="p-3 border-b border-zinc-300 font-bold">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">event</td>
        <td class="p-3 border-b border-zinc-200 text-zinc-500">string</td>
        <td class="p-3 border-b border-zinc-200">Always <code>"upload.committed"</code> for successful uploads.</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">object_key</td>
        <td class="p-3 border-b border-zinc-200 text-zinc-500">string</td>
        <td class="p-3 border-b border-zinc-200">The raw internal storage path (e.g., <code>uploads/123/my_blog_v1/image.png</code>).</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">cdn_url</td>
        <td class="p-3 border-b border-zinc-200 text-zinc-500">string</td>
        <td class="p-3 border-b border-zinc-200">The public, resolvable URL of the image. Save this in your database!</td>
      </tr>
      <tr>
        <td class="p-3 font-mono text-indigo-700">committed_at</td>
        <td class="p-3 text-zinc-500">string (ISO)</td>
        <td class="p-3">Timestamp of when the upload was finalized.</td>
      </tr>
    </tbody>
  </table>
</div>

<pre><code>// Webhook Payload Example
&#123;
  "event": "upload.committed",
  "object_key": "uploads/123/my_blog_v1/image.png",
  "cdn_url": "https://cdn.example.com/uploads/123/my_blog_v1/image.png",
  "committed_at": "2023-10-01T12:00:00Z"
&#125;</code></pre>
