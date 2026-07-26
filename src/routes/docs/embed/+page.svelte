<h1>Embed Widget</h1>

<p>
  The easiest way to integrate ext-util into your application (e.g. a blog editor) is by using the pre-built, headless drag-and-drop widget.
</p>

<h2>1. Embed the Iframe</h2>
<p>Place this iframe anywhere in your main application (Next.js, SvelteKit, Vue, etc.):</p>
<pre><code>&lt;iframe 
  src="https://util.avadhya.in/upload-card" 
  width="100%" 
  height="350" 
  style="border: none; border-radius: 8px;"
&gt;&lt;/iframe&gt;</code></pre>

<h2>2. Organization & Theming (Query Params)</h2>
<p>You can pass query parameters to the URL to customize the upload destination and default UI states:</p>
<ul>
  <li><code>project_id</code>: (String) Organizes the uploaded image into a specific folder (e.g., <code>?project_id=my_blog</code>).</li>
  <li><code>rounded</code>: (Boolean) Defaults the HTML snippet to have rounded corners (e.g., <code>?rounded=true</code>).</li>
  <li><code>shadow</code>: (Boolean) Defaults the HTML snippet to have a box shadow (e.g., <code>?shadow=true</code>).</li>
  <li><code>responsive</code>: (Boolean) Defaults the HTML snippet to be responsive (e.g., <code>?responsive=true</code>).</li>
</ul>

<h2>3. Listen for Success Events</h2>
<p>When an image is successfully uploaded, the widget fires a <code>postMessage</code> to the parent window containing the CDN URL.</p>
<pre><code>window.addEventListener('message', (event) =&gt; &#123;
  // Always verify the origin in production!
  // if (event.origin !== "https://util.avadhya.in") return;

  const data = event.data;
  
  if (data &amp;&amp; data.type === 'EXT_UTIL_UPLOAD_SUCCESS') &#123;
    console.log("Image uploaded successfully! CDN URL:", data.url);
    
    // Example: Insert into Tiptap editor
    // editor.chain().focus().setImage(&#123; src: data.url &#125;).run();
  &#125;
&#125;);</code></pre>

<div class="mt-8">
  <a href="/docs/api" class="inline-block px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 transition-colors">Headless API Guide &rarr;</a>
</div>
