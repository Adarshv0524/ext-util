<h1>Image Organization</h1>

<p>
  When integrating <strong>imgapi</strong> into your application, you don't want all your users' images dumped into a single giant folder. 
  Our utility provides built-in <strong>project-based organization</strong> so you know exactly where everything is stored in your Cloudflare R2 bucket.
</p>

<h2>The Folder Structure</h2>
<p>Ext-util automatically structures your uploads like a file system. It uses three levels of organization:</p>

<div class="p-4 bg-[#0f172a] border border-slate-700 rounded-lg mt-4 mb-6 font-mono text-sm text-slate-300">
  <div class="flex items-center gap-2 mb-2"><span class="text-teal-400">📁 uploads/</span> <span class="text-slate-500">(Root directory)</span></div>
  <div class="flex items-center gap-2 mb-2 ml-4"><span class="text-teal-400">📁 [project_id]/</span> <span class="text-slate-500">(e.g., my_blog, your_app_name)</span></div>
  <div class="flex items-center gap-2 mb-2 ml-8"><span class="text-teal-400">📁 [asset_type]/</span> <span class="text-slate-500">(e.g., avatars, inline_images)</span></div>
  <div class="flex items-center gap-2 mb-2 ml-12"><span class="text-slate-300">📄 [user_id]_[timestamp].ext</span> <span class="text-slate-500">(The actual file)</span></div>
</div>

<h2>How to set the Project ID</h2>
<p>You can isolate assets for different apps, tenants, or projects by simply passing the <code>project_id</code> property.</p>

<h3>Method 1: Via the Embed Widget (Easiest)</h3>
<p>If you are using the iframe widget, simply append <code>project_id=YOUR_FOLDER_NAME</code> to the URL:</p>
<pre><code>&lt;iframe src="https://imgapi.avadhya.in/upload-card?project_id=my_cool_blog"&gt;&lt;/iframe&gt;</code></pre>
<p>If a user named "Alice" (User ID: 123) uploads an avatar using this widget, the file will be saved precisely here:</p>
<pre><code>uploads/my_cool_blog/avatar/123_1700000000.png</code></pre>

<h3>Method 2: Via the API (Advanced)</h3>
<p>If you are building your own UI and using our `media-client.ts`, pass the <code>projectId</code> in the options object:</p>
<pre><code>const result = await uploadToExtUtil(&#123;
  file: imageFile,
  projectId: 'my_cool_blog',
  assetType: 'article_hero'
&#125;);</code></pre>

<h2>Security & Validation</h2>
<div class="p-4 bg-slate-800/50 border border-teal-500/30 rounded-lg mt-6">
  <h3 class="text-sm font-bold text-teal-400 m-0 mb-2">Safe Folder Names Only</h3>
  <p class="text-sm text-slate-300 m-0">To prevent path traversal attacks, the <code>project_id</code> is strictly limited to <strong>32 characters</strong> and only accepts <strong>alphanumeric characters, hyphens, and underscores</strong>. If you try to pass `../secret_folder`, the upload will be rejected automatically.</p>
</div>
