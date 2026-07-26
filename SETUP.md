# 🚀 Comprehensive Setup Guide: imgapi Microservice

This guide walks you through setting up the **imgapi** multi-tenant SaaS microservice from scratch. It assumes you have never used Cloudflare R2 (Object Storage), D1 (Database), or KV (Key-Value store) before.

---

## 🤯 Where Does the Data Go?

Because this application runs directly on Cloudflare's Edge (Cloudflare Workers), you don't need traditional database URLs or S3 credentials. Cloudflare securely injects these resources directly into the application based on your `wrangler.toml` file.

Here is exactly where your data is stored on Cloudflare's servers:

1. **D1 (Serverless SQLite Database)**: 
   - **What it stores:** Users (Google OAuth signups), Active Login Sessions, Developer Projects (and their `HMAC_SECRETS`), Admin Settings (like `AUTO_APPROVE_USERS`), and a ledger of all uploaded images.
   - **How it works:** It's a relational database distributed across Cloudflare's edge network.
2. **R2 Bucket (Object Storage)**:
   - **What it stores:** The actual image files (`.png`, `.jpg`, `.webp`) that users upload.
   - **How it works:** Cloudflare's equivalent to AWS S3, but without egress fees.
3. **KV Namespace (Key-Value Store)**:
   - **What it stores:** Short-lived, temporary upload tokens.
   - **How it works:** Ensures that once a token is used to upload an image, it cannot be used again (one-time use).

---

## 🛠 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher) & **npm**
- A **Cloudflare Account** (Sign up at dash.cloudflare.com)
- A **Google Cloud Account** (For OAuth login credentials. Any Gmail account, like `theawadhilanguage@gmail.com`, works perfectly).

---

## Step 1: Install Wrangler & Login

Wrangler is the official Cloudflare command-line tool.

1. Install Wrangler globally on your machine:
   ```bash
   npm install -g wrangler
   ```
2. Authenticate Wrangler with your Cloudflare account (this opens a browser window):
   ```bash
   wrangler login
   ```

---

## Step 2: Create Cloudflare Resources

Run the following commands in your terminal and carefully note the IDs it outputs.

1. **Create the R2 Bucket (File Storage)**
   ```bash
   wrangler r2 bucket create imgapi-media
   ```

2. **Create the KV Namespace (Temporary Storage)**
   ```bash
   wrangler kv:namespace create "TOKEN_KV"
   ```
   *Note: Copy the `id` from the terminal output.*

3. **Create the D1 Database (SQL Ledger & Auth)**
   ```bash
   wrangler d1 create media_assets_db
   ```
   *Note: Copy the `database_id` from the terminal output.*

---

## Step 3: Update `wrangler.toml`

Open the `wrangler.toml` file in the root directory. This file maps the Cloudflare resources you just created to your code. Update it with the IDs you copied in Step 2:

```toml
name = "imgapi"
compatibility_date = "2024-07-26" 

# 1. R2 Bucket
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "imgapi-media"

# 2. KV Namespace
[[kv_namespaces]]
binding = "TOKEN_KV"
id = "PASTE_YOUR_KV_ID_HERE"

# 3. D1 Database
[[d1_databases]]
binding = "MEDIA_DB"
database_name = "media_assets_db"
database_id = "PASTE_YOUR_D1_ID_HERE"
```

---

## Step 4: Run Database Migrations

Your D1 database needs tables to store Users, Sessions, Projects, and Images. We use SQL files to create these tables.

1. **Local Development (Testing on your computer)**:
   ```bash
   npx wrangler d1 execute media_assets_db --local --file=migrations/schema.sql
   npx wrangler d1 execute media_assets_db --local --file=migrations/0002_add_auth_schema.sql
   ```

2. **Production Setup (Applying to Cloudflare servers)**:
   ```bash
   npx wrangler d1 execute media_assets_db --remote --file=migrations/schema.sql
   npx wrangler d1 execute media_assets_db --remote --file=migrations/0002_add_auth_schema.sql
   ```

---

## Step 5: Configure Google OAuth & Secrets

To allow developers to log in and use your service, you need to get Google OAuth credentials. 

### 1. Get Google Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a New Project.
3. Go to **APIs & Services > Credentials** and create an **OAuth 2.0 Client ID** (Web Application).
4. Set the **Authorized redirect URIs** to:
   - `http://localhost:5173/login/google/callback` (for local dev)
   - `https://imgapi.avadhya.in/login/google/callback` (for production)
5. Copy the Client ID and Client Secret.

### 2. Local Development (`.dev.vars`)
Create a file named `.dev.vars` in the root of the project. This acts like a `.env` file for Cloudflare Workers.

```env
# 1. Google OAuth Credentials
GOOGLE_CLIENT_ID="your_google_client_id_here"
GOOGLE_CLIENT_SECRET="your_google_client_secret_here"

# 2. Admin Setup (Comma-separated emails that get Admin rights)
ADMIN_EMAILS="theawadhilanguage@gmail.com"

# 3. Email Notifications (Optional - Get an API key from Resend.com)
RESEND_API_KEY="re_123456789"

# 4. Global Fallback HMAC Secret
HMAC_SECRET="my_super_secret_key_123!"

# 5. URLs
CDN_BASE_URL="http://localhost:5173"
APP_URL="http://localhost:5173"
```

### 3. Production Secrets
For production, Cloudflare does not upload your `.dev.vars` file for security. You must inject these secrets directly into Cloudflare via the terminal:

```bash
wrangler pages secret put GOOGLE_CLIENT_ID --project-name imgapi
wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name imgapi
wrangler pages secret put ADMIN_EMAILS --project-name imgapi
wrangler pages secret put HMAC_SECRET --project-name imgapi
wrangler pages secret put CDN_BASE_URL --project-name imgapi
wrangler pages secret put APP_URL --project-name imgapi
```
*(Optionally put `RESEND_API_KEY` as well)*

---

## Step 6: Running & Deploying

### Running Locally
To test the microservice on your computer:
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. 
*(Note: When you log in with Google using the email you set in `ADMIN_EMAILS`, you will automatically bypass the waitlist and be granted an `ADMIN` role.)*

### Deploying to Production
When you are ready to publish the service live on the internet:
```bash
npm run build
npm run deploy
```
*Cloudflare will give you a live `.workers.dev` URL, which you can later map to `imgapi.avadhya.in` in your Cloudflare dashboard under Custom Domains.*
