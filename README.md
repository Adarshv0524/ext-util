# 🌐 ext-util (util.avadhya.in)
**A Decoupled, Edge-Native Image Handling Microservice**

`ext-util` is a high-performance, standalone Image Microservice built entirely in SvelteKit and designed exclusively for the Cloudflare edge environment. 

It acts as an **external utility API and Add-on store** designed to securely handle image uploads for other websites (such as a main site hosting a Tiptap editor). By offloading image handling to `ext-util`, your main application remains decoupled from binary storage logic and bandwidth.

---

## 🎯 Precise Project Aims

The primary goal of `ext-util` is to act as a **centralized external utility API** that handles all heavy lifting related to image uploads for the broader Avadhya ecosystem. 

By offloading this responsibility to a dedicated microservice, we achieve:
1. **Decoupling**: The main application no longer has to process large binary payloads, manage S3 buckets, or deal with multi-part form parsing. It simply asks `ext-util` to do it, and receives a public URL in return.
2. **Edge Performance**: Uploads stream directly from the user's browser into Cloudflare R2 object storage at the network edge, bypassing any middleman servers and reducing latency drastically.
3. **Security by Isolation**: The main application never handles image files directly, mitigating the risk of malicious file uploads taking down the core server. `ext-util` handles magic-byte verification and HMAC signature validation natively on the edge.
4. **Automated Cleanup (Orphan Management)**: Using a 3-Phase upload protocol and an SQLite ledger (Cloudflare D1), the microservice guarantees that images abandoned during upload (e.g., the user closes the tab before finishing) are automatically purged, saving storage costs.

---

## ✨ Core Features & Architecture

- **Cross-Origin API (CORS enabled)**: Upload images from any domain (like your main app) directly to this service securely via global `OPTIONS` middleware.
- **Three-Phase Protocol**: Secures direct-to-edge uploads without straining a proxy server.
  1. `Phase 1`: Client requests an upload token. Server validates size/MIME limits and returns an HMAC-SHA256 signed token with a strict TTL.
  2. `Phase 2`: Client streams the raw binary directly to the Edge URL (`/upload/[...key]`). Edge verifies magic-bytes and the token signature.
  3. `Phase 3`: Client calls `/api/v1/media/commit` to confirm the upload was successful and attached to an entity, marking it safe from the Orphan Cleanup cron job.
- **Embeddable Upload Card**: A pre-built, headless drag-and-drop widget (`/upload-card`) that can be embedded via `iframe` and communicates back to your main app via `postMessage`.
- **Zero External Dependencies**: Security and HMAC validation are built 100% using the native Web Crypto API. No bloated npm packages required.
- **Cloudflare Native**: Optimized specifically for Cloudflare Workers (Compute), R2 Buckets (Blob Storage), D1 Database (Ledger), and KV namespaces (Short-lived tokens).

---

## 🛠 Developer Experience & Configuration

All configurable limits are centralized to prevent spaghetti code. 

**`src/lib/constants.ts`** is the single source of truth for:
- Maximum file sizes (e.g., `user_avatar` = 2MB, `article_inline` = 5MB).
- Allowed MIME types.
- Token TTLs (Time-To-Live expiration limits).

Changes made to `constants.ts` automatically apply to both the backend Edge security checks and the dynamic frontend documentation page!

---

## 📚 Documentation & Guides

To keep this project easy to use and maintain, the documentation is broken down into specific guides:

1. **[Setup Guide](./SETUP.md)**: A beginner-friendly, step-by-step tutorial on provisioning Cloudflare resources (R2/D1/KV), configuring environment variables (`.env`), and running the project locally. Read this first!
2. **[Usage Guide](./USAGE_GUIDE.md)**: Clear code examples showing how to integrate the API client or the embeddable Upload Card into your main website. Includes example `postMessage` listeners and Headless API requests.
