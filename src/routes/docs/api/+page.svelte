<h1>API Reference</h1>

<p>If you prefer to build your own custom UI, you can use the headless API Client provided by ext-util.</p>

<h2>Using the Client Library</h2>
<p>In your main application, you can use the <code>uploadToExtUtil</code> function. (You can copy <code>src/lib/client/media-client.ts</code> to your own project).</p>

<pre><code>import &#123; uploadToExtUtil, commitExtUtilAsset &#125; from './media-client';

async function handleImageDrop(file) &#123;
  const result = await uploadToExtUtil(&#123;
    file: file,
    userId: 123,
    assetType: 'article_inline',
    projectId: 'my_blog_platform',
    apiBaseUrl: 'https://util.avadhya.in'
  &#125;);

  if (result.error) &#123;
    alert("Upload failed: " + result.error);
    return;
  &#125;

  const &#123; object_key, cdn_url &#125; = result;
  console.log("Uploaded! URL:", cdn_url);

  // Phase 3: Commit the asset to prevent orphan cleanup
  await commitExtUtilAsset(object_key, 'articles', articleId, 123, 'https://util.avadhya.in');
&#125;</code></pre>

<h2>Direct REST Endpoints</h2>

<h3>POST <code>/api/v1/media/upload-token</code></h3>
<p>Requests a secure token to begin an edge upload.</p>
<pre><code>// Request Body
&#123;
  "asset_type": "article_inline",
  "mime_type": "image/png",
  "file_size_bytes": 102400,
  "file_name": "image.png",
  "uploader_user_id": 123,
  "project_id": "my_blog_platform" // Optional
&#125;</code></pre>

<h3>PUT <code>/upload/[...key]</code></h3>
<p>Streams the raw binary directly into Cloudflare R2 using the token acquired from Phase 1.</p>
