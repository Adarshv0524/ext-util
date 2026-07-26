<h1>Widget Integration</h1>

<p>
  The easiest way to integrate imgapi into your application is by using the pre-built, headless drag-and-drop widget.
  It requires zero backend code and works out-of-the-box.
</p>

<h2>1. Embed the Iframe</h2>
<p>Place this iframe anywhere in your main application (Next.js, SvelteKit, Vue, etc.):</p>
<pre><code>&lt;iframe 
  src="https://imgapi.avadhya.in/upload-card?project_id=my_blog_v1" 
  width="100%" 
  height="350" 
  style="border: none; border-radius: 8px;"
&gt;&lt;/iframe&gt;</code></pre>

<h2>2. Configuration Parameters</h2>
<p>You can customize the widget's behavior by passing query parameters directly in the iframe URL.</p>

<div class="overflow-x-auto my-6">
  <table class="min-w-full text-left text-sm border-collapse border border-zinc-300">
    <thead class="bg-zinc-200/50">
      <tr>
        <th class="p-3 border-b border-zinc-300 font-bold">Parameter</th>
        <th class="p-3 border-b border-zinc-300 font-bold">Type</th>
        <th class="p-3 border-b border-zinc-300 font-bold">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">project_id</td>
        <td class="p-3 border-b border-zinc-200">String</td>
        <td class="p-3 border-b border-zinc-200">Organizes the uploaded image into a specific folder in the R2 bucket.</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">demo</td>
        <td class="p-3 border-b border-zinc-200">Boolean</td>
        <td class="p-3 border-b border-zinc-200">Set to <code>true</code> to test the UI without actually uploading files.</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">rounded</td>
        <td class="p-3 border-b border-zinc-200">Boolean</td>
        <td class="p-3 border-b border-zinc-200">Defaults the HTML export snippet to have rounded corners.</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">shadow</td>
        <td class="p-3 border-b border-zinc-200">Boolean</td>
        <td class="p-3 border-b border-zinc-200">Defaults the HTML export snippet to have a box shadow.</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">responsive</td>
        <td class="p-3 border-b border-zinc-200">Boolean</td>
        <td class="p-3 border-b border-zinc-200">Defaults the HTML export snippet to use responsive widths.</td>
      </tr>
      <tr>
        <td class="p-3 border-b border-zinc-200 font-mono text-indigo-700">accept</td>
        <td class="p-3 border-b border-zinc-200">String</td>
        <td class="p-3 border-b border-zinc-200">Overrides the allowed file types (e.g., <code>image/webp,image/png</code>).</td>
      </tr>
      <tr>
        <td class="p-3 font-mono text-indigo-700">maxSize</td>
        <td class="p-3">Number</td>
        <td class="p-3">Overrides the max file size in Megabytes (e.g., <code>5</code>). Defaults to 15.</td>
      </tr>
    </tbody>
  </table>
</div>

<h2>3. Listen for Success Events</h2>
<p>When an image is successfully uploaded, the widget fires a <code>postMessage</code> to your parent window.</p>
<pre><code>window.addEventListener('message', (event) =&gt; &#123;
  // Security: Always verify the origin in production!
  // if (event.origin !== "https://imgapi.avadhya.in") return;

  const data = event.data;
  
  if (data &amp;&amp; data.type === 'EXT_UTIL_UPLOAD_SUCCESS') &#123;
    console.log("Uploaded URL:", data.url);
    
    // Example: Insert image into a Tiptap text editor
    // editor.chain().focus().setImage(&#123; src: data.url &#125;).run();
  &#125;
&#125;);</code></pre>
