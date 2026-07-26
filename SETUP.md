# 🚀 Comprehensive Setup Guide: ext-util Microservice

This guide will walk you through setting up the `ext-util` microservice from scratch. It assumes you have never used Cloudflare R2 (Object Storage), D1 (Database), or KV (Key-Value store) before. 

---

## 🤯 Why are there no API Keys, Database URLs, or S3 Credentials?

If you have used AWS S3 or traditional databases before, you are probably looking for an `AWS_ACCESS_KEY_ID`, a database connection string like `postgres://...`, or an Account ID.

**You do NOT need them!** 

Because this application runs directly on Cloudflare's Edge (Cloudflare Workers), Cloudflare uses a concept called **Bindings**. 
Instead of sending network requests over the internet using passwords, Cloudflare securely injects the Database, KV, and R2 bucket directly into the application's memory at runtime based on the `wrangler.json` file. 
- You never manage database passwords.
- You never manage S3 API tokens.
- Everything is instantly available via `platform.env.R2_BUCKET`, etc.

---

## 🛠 Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js** (v18 or higher) & **npm**
- A **Cloudflare Account** (Sign up at dash.cloudflare.com — it has a very generous free tier)

---

## Step 1: Install Wrangler (Cloudflare CLI) & Login

Wrangler is the command-line tool used to manage Cloudflare resources.

1. Install Wrangler globally on your machine:
   ```bash
   npm install -g wrangler
   ```
2. Authenticate Wrangler with your Cloudflare account. This will open a browser window for you to log in:
   ```bash
   wrangler login
   ```

---

## Step 2: Create the R2 Bucket (Object Storage)

R2 is Cloudflare's equivalent to AWS S3. This is where the physical image files will be stored.

1. Run the following command to create a bucket named `ext-util-media`:
   ```bash
   wrangler r2 bucket create ext-util-media
   ```
2. *Note: You can name it whatever you like, but if you change it, remember to update the `bucket_name` in Step 5.*

---

## Step 3: Create the D1 Database (Ledger)

D1 is Cloudflare's serverless SQLite database. We use this to keep a ledger of all uploaded images (to track if they are orphaned or committed).

1. Run the following command to create the database:
   ```bash
   wrangler d1 create media_assets_db
   ```
2. **Important:** After running this command, the terminal will output a block of JSON that looks like this:
   ```json
   [[d1_databases]]
   binding = "MEDIA_DB"
   database_name = "media_assets_db"
   database_id = "xxxx-xxxx-xxxx-xxxx-xxxx"
   ```
   **Copy the `database_id`**, you will need it in Step 5.

---

## Step 4: Create the KV Namespace (Temporary Storage)

KV is a fast, globally distributed key-value store. We use this to temporarily store the Phase 1 Upload Tokens (which expire automatically).

1. Run the following command to create the namespace:
   ```bash
   wrangler kv:namespace create "TOKEN_KV"
   ```
2. **Important:** The terminal will output an ID:
   ```text
   { binding = "TOKEN_KV", id = "yyyy-yyyy-yyyy-yyyy-yyyy" }
   ```
   **Copy the `id`**, you will need it in Step 5.

---

## Step 5: Update `wrangler.toml`

This file is the "magic" that connects your code to Cloudflare without needing passwords or API keys.

1. Open the file named `wrangler.toml` in the root of your project.
2. Update it with the IDs you copied from Steps 3 and 4:

```toml
name = "ext-util"
compatibility_date = "2024-07-26" 

# 1. R2 Bucket (Object Storage for Images)
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "ext-util-media"

# 2. KV Namespace (Temporary storage for tokens)
[[kv_namespaces]]
binding = "TOKEN_KV"
id = "PASTE_YOUR_KV_ID_HERE"             # Replace this with the ID from Step 4

# 3. D1 Database (Ledger for tracking assets and orphans)
[[d1_databases]]
binding = "MEDIA_DB"
database_name = "media_assets_db"
database_id = "PASTE_YOUR_D1_ID_HERE"    # Replace this with the ID from Step 3
```

---

## Step 6: Configure Environment Variables & Secrets

Your application needs a secure key (HMAC secret) to prevent unauthorized uploads. This is the **only** secret you need to manage.

### For Local Development (`.env` file)
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and set a secure, random string for `HMAC_SECRET`:
   ```env
   # Generate a random string like "my_super_secret_key_123!"
   HMAC_SECRET="your_custom_secret_key"
   CDN_BASE_URL="http://localhost:5173"
   ```

### For Production Cloudflare (Wrangler Secrets)
Cloudflare does not upload your `.env` file for security reasons. You must inject secrets directly into Cloudflare:

1. Run the following command:
   ```bash
   wrangler secret put HMAC_SECRET
   ```
2. When prompted, paste the exact same secret string you used in your `.env` file.

---

## Step 7: Centralized Constants

If you ever need to change limits (like maximum image sizes or allowed formats), you do **not** need to hunt through the code. 
Simply open:
`src/lib/constants.ts`

Changing values here will automatically update the backend security rules AND the frontend documentation page.

---

## Step 8: Running & Deploying

### Running Locally
To test the app on your computer:
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. *(Note: During local dev, Wrangler safely mocks your Cloudflare resources using local files so you don't accidentally affect production data).*

### Deploying to Production
When you are ready to put the service live on the internet:
```bash
npm run build
npm run deploy
```
*Cloudflare will give you a live `.workers.dev` URL, which you can later map to `util.avadhya.in` in your Cloudflare dashboard.*
