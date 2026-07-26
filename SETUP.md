# Setup Guide

This guide will walk you through setting up the environment variables and configuration for the `ext-util` microservice.

## 1. Unified Configuration

All static configuration limits and environment defaults are located in a unified file:
`src/lib/server/config.ts`

This file handles fallback defaults and merges them with Cloudflare's request-scoped `platform.env`.

## 2. Environment Variables (`.env`)

For local development using Vite (e.g., `npm run dev`), SvelteKit's Cloudflare adapter reads variables from `wrangler.json` (for bindings like KV, D1, R2) but you can also provide a `.env` file for secrets.

Create a `.env` file in the root directory:

```env
# The secret used to sign HMAC tokens for secure uploads.
# Must be a long, random string. Do NOT leak this to the client.
HMAC_SECRET="your_super_secret_hmac_key_here"

# The base URL for the CDN (how images will be served).
# For local dev, this is usually http://localhost:5173
CDN_BASE_URL="http://localhost:5173"
```

## 3. Wrangler Configuration (`wrangler.json`)

Cloudflare resources are mapped via `wrangler.json`. Ensure the following bindings exist:

```json
{
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "ext-util-media"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "TOKEN_KV",
      "id": "token_kv_id"
    }
  ],
  "d1_databases": [
    {
      "binding": "MEDIA_DB",
      "database_name": "media_assets_db",
      "database_id": "media_db_id"
    }
  ]
}
```

*Note: In local dev, if D1/R2/KV bindings are not properly mocked by Wrangler, `ext-util` automatically falls back to safe in-memory data structures so you can test uploads without configuring Cloudflare.*

## 4. Running Locally

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

The service will be accessible at `http://localhost:5173`.
