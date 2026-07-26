<h1>Quickstart</h1>

<p>Start using the hosted <strong>ext-util</strong> image microservice in your applications in under a minute.</p>

<h2>1. The Easiest Way: Iframe Embed</h2>
<p>You can drop the upload widget directly into your app. This requires zero setup and no backend code. By using the iframe, you get a beautiful drag-and-drop interface out of the box.</p>
<pre><code>&lt;iframe 
  src="https://util.avadhya.in/upload-card?project_id=my_new_app" 
  width="100%" 
  height="350" 
  style="border: none; border-radius: 8px;"
&gt;&lt;/iframe&gt;</code></pre>
<p class="text-sm mt-2 text-zinc-500"><em>Tip: Change <code>my_new_app</code> to your actual project name to keep your uploads organized in our buckets!</em></p>

<h2>2. Listen for Uploads</h2>
<p>When your users upload an image using the widget, it will send a message to your parent window with the final CDN URL.</p>
<pre><code>window.addEventListener('message', (event) =&gt; &#123;
  // Make sure you only listen to our domain in production
  // if (event.origin !== "https://util.avadhya.in") return;

  if (event.data &amp;&amp; event.data.type === 'EXT_UTIL_UPLOAD_SUCCESS') &#123;
    console.log("Image ready! URL is:", event.data.url);
    // Example: Update an image tag in your app
    // document.getElementById('my-image').src = event.data.url;
  &#125;
&#125;);</code></pre>

<h2>3. What if I want a custom UI?</h2>
<p>If you want to build your own drag-and-drop area instead of using our widget, you can use our headless API client. Head over to the API Reference to learn how to integrate it directly into your frontend code.</p>

<div class="mt-8 flex gap-4">
  <a href="/docs/embed" class="inline-flex px-4 py-2 bg-indigo-700 text-white font-medium rounded-md hover:bg-indigo-800 transition-colors shadow-sm">Read the Full Embed Guide &rarr;</a>
</div>
