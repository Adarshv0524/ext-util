# Usage Guide

Because `ext-util` acts as an external microservice and upload store, it provides two primary ways for your main website (e.g., your Tiptap editor app) to interact with it: **The Embeddable Upload Card** and **The Direct API Client**.

## Method 1: Embeddable Image Upload Card (Iframe)

You can embed the `ext-util` UI directly into your main website. This handles the drag-and-drop, validation, and multi-step upload protocol automatically.

### 1. Embed the Iframe in your Main App

```html
<!-- Inside your main application (e.g. Next.js, React, or SvelteKit) -->
<iframe 
  src="https://ext-util.example.com/upload-card" 
  width="450" 
  height="400" 
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #eaeaea;"
></iframe>
```

### 2. Listen for the Upload Success Event

When the user drops an image into the iframe and it successfully uploads, the iframe fires a `postMessage` to the parent window.

```javascript
// In your main application
window.addEventListener('message', (event) => {
  // Always verify the origin in production!
  // if (event.origin !== "https://ext-util.example.com") return;

  const data = event.data;
  
  if (data && data.type === 'EXT_UTIL_UPLOAD_SUCCESS') {
    console.log("Image uploaded successfully! CDN URL:", data.url);
    
    // Example: Insert into Tiptap editor
    // editor.chain().focus().setImage({ src: data.url }).run();
  }
});
```

---

## Method 2: Direct API Client (Headless)

If you want to build your own UI or integrate the upload invisibly (e.g., when a user drops an image directly onto the Tiptap editor), use the API client snippet.

### 1. Copy the Client API

Copy the contents of `src/lib/client/media-client.ts` from this repo into your main application's source code.

### 2. Use the Client API

```javascript
import { uploadToExtUtil, commitExtUtilAsset } from './media-client';

async function handleImageDrop(file) {
  // Phase 1 & 2: Request token and upload binary stream
  const result = await uploadToExtUtil({
    file: file,
    userId: 123, // Your user's ID
    assetType: 'article_inline',
    apiBaseUrl: 'https://ext-util.example.com' // Point to your ext-util deployment
  });

  if (result.error) {
    alert("Upload failed: " + result.error);
    return;
  }

  const { object_key, cdn_url } = result;
  console.log("Uploaded! Temporary URL:", cdn_url);

  // Example: Insert into Tiptap editor immediately
  editor.chain().focus().setImage({ src: cdn_url }).run();

  // Phase 3: Commit the asset to prevent orphan cleanup
  // You can do this immediately, or later when the article is saved.
  await commitExtUtilAsset(object_key, 'articles', articleId, 123, 'https://ext-util.example.com');
}
```

## CORS Details

By default, the `ext-util` service has CORS enabled (`Access-Control-Allow-Origin: *`) on all `/api/*` and `/upload/*` routes via `src/hooks.server.ts`. If you move to production, you can lock this down to your main website's domain in the hook file.
