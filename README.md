# ext-util

**ext-util** is a high-performance, standalone Image Microservice and Upload Store built entirely in SvelteKit for Cloudflare edge environments.

It acts as an **external utility API and Add-on store** designed to securely handle image uploads for other websites (such as a main site hosting a Tiptap editor). By offloading image handling to `ext-util`, your main application remains decoupled from binary storage logic and bandwidth.

## Features

- **Cross-Origin API (CORS enabled)**: Upload images from any domain directly to the `ext-util` service.
- **Three-Phase Protocol**: Secures direct-to-edge uploads without straining a proxy server.
- **Embeddable Upload Card**: A pre-built, stylized UI widget (`/upload-card`) that handles drag-and-drop uploads and communicates back to your main app via `postMessage`.
- **Zero External Dependencies**: Security and HMAC validation built 100% using the native Web Crypto API.
- **Cloudflare Native**: Optimized for Cloudflare Workers, R2 Buckets, D1 Database, and KV namespaces.

## Documentation

- [Setup Guide](./SETUP.md) - Instructions for configuring environment variables, Cloudflare bindings, and running locally.
- [Usage Guide](./USAGE_GUIDE.md) - Instructions on how to integrate the API client or the embeddable Upload Card into your main website.
