<h1>Image Organization</h1>

<p>
  When building large applications, dropping all images into a single folder becomes unmanageable. ext-util provides native organization logic to securely segregate assets in your Cloudflare R2 bucket.
</p>

<h2>The Default Structure</h2>
<p>By default, if you don't specify a project, images are stored by <code>asset_type</code>:</p>
<pre><code>uploads/[asset_type]/[user_id]_[timestamp]_[random].ext</code></pre>

<h2>Project-Based Organization</h2>
<p>You can isolate assets for different apps, tenants, or projects by passing the <code>project_id</code> property.</p>

<h3>Via the Embed Widget</h3>
<p>Simply append the <code>project_id</code> to the iframe URL:</p>
<pre><code>&lt;iframe src="https://util.avadhya.in/upload-card?project_id=my_blog_v1"&gt;&lt;/iframe&gt;</code></pre>

<h3>Via the API</h3>
<p>Pass the <code>projectId</code> in the <code>uploadToExtUtil</code> options:</p>
<pre><code>const result = await uploadToExtUtil(&#123;
  file: imageFile,
  projectId: 'my_blog_v1'
&#125;);</code></pre>

<h2>Resulting Bucket Path</h2>
<p>When a <code>project_id</code> is provided, the API safely sanitizes it (removing illegal characters to prevent directory traversal) and creates a deterministic path in the R2 Bucket:</p>
<pre><code>uploads/my_blog_v1/article_inline/1_169000000_abcd123.png</code></pre>

<div class="p-4 bg-gray-50 border border-gray-200 rounded-lg mt-6">
  <h3 class="text-sm font-bold text-gray-900 m-0 mb-2">Security Note</h3>
  <p class="text-sm text-gray-600 m-0">The <code>project_id</code> is limited to 32 characters and only accepts alphanumeric characters, hyphens, and underscores.</p>
</div>
