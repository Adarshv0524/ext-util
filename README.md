# 🌐 util.avadhya.in (ext-util)
**A Decoupled, Edge-Native Image Handling Microservice**

`ext-util` is a high-performance, standalone Image Microservice built entirely in SvelteKit and designed exclusively for the Cloudflare edge environment (Workers, R2, D1, and KV).

## 🎯 Precise Project Aims

The primary goal of `ext-util` is to act as a **centralized external utility API** that handles all heavy lifting related to image uploads for the broader Avadhya ecosystem. 

By offloading this responsibility to a dedicated microservice, we achieve:
1. **Decoupling**: The main application (e.g., a website hosting a Tiptap editor) no longer has to process large binary payloads or manage S3 buckets. It simply asks `ext-util` to do it, and receives a public URL in return.
2. **Edge Performance**: Uploads stream directly from the user's browser into Cloudflare R2 object storage at the network edge, bypassing any middleman servers and reducing latency.
3. **Security by Isolation**: The main application never handles image files directly, mitigating the risk of malicious file uploads taking down the core server. `ext-util` handles magic-byte verification and HMAC signature validation on the edge.
4. **Automated Cleanup (Orphan Management)**: Using a 3-Phase upload protocol and an SQLite ledger (Cloudflare D1), the microservice guarantees that images abandoned during upload (e.g., the user closes the tab before finishing) are automatically purged, saving storage costs.

## ✨ Core Features

- **Cross-Origin API (CORS enabled)**: Upload images from any domain (like your main app) directly to this service securely.
- **Embeddable Upload Card**: A pre-built, headless drag-and-drop widget (`/upload-card`) that can be embedded via `iframe` and communicates back to your main app via `postMessage`.
- **Headless API**: Easy-to-use endpoints for server-to-server or direct client-to-server integration.
- **Zero External Dependencies**: Security and HMAC validation are built 100% using the native Web Crypto API.

## 📚 Documentation & Guides

To keep this project easy to use and maintain, the documentation is broken down into specific guides:

- **[Setup Guide](./SETUP.md)**: A beginner-friendly, step-by-step tutorial on provisioning Cloudflare resources (R2/D1/KV), configuring environment variables, and running the project locally.
- **[Usage Guide](./USAGE_GUIDE.md)**: Clear code examples showing how to integrate the API client or the embeddable Upload Card into your main website.

## 🛠 Developer Experience

All configurable limits (MIME types, file size caps, expiration times) are centralized in a single file (`src/lib/constants.ts`). This file is heavily documented, and changes made there automatically apply to both the backend security checks and the frontend documentation page.
