# Architectural Audit — Awadhi Literature Platform v5.0
## Section 1: System & Data Flow Map — Decoupled Image Microservice

**Document Status:** Implementation-Ready Draft  
**Scope:** Cloudflare Worker + R2 image upload integration as a sidecar to the existing SvelteKit → FastAPI → MySQL stack  
**Prepared For:** Infrastructure Lead review; covers topology, three upload flows, URL lifecycle, and architectural rationale

---

## A. Macro Architecture Addition

### A.1 Positioning the Image Microservice

The image upload microservice is a **fully decoupled sidecar** that sits alongside the existing application stack. It is not a new internal FastAPI module — it is an external Cloudflare Worker deployed to Cloudflare's global edge network. Its responsibilities are narrow and strictly bounded:

| Responsibility | Owner |
|:---|:---|
| Issue time-limited, scoped upload tokens (presigned POST policies) | FastAPI `/api/v1/images/upload-token` |
| Accept the binary image payload and persist it to R2 | Cloudflare Worker + R2 Bucket |
| Store the returned public R2 URL as a plain `VARCHAR` string | FastAPI → MySQL |
| Serve the image to end users on subsequent requests | Cloudflare CDN (R2 public bucket URL) |

The FastAPI backend **never receives, buffers, or proxies the binary image bytes.** Its only role in the upload path is JWT-authenticated token issuance. The SvelteKit frontend directly `POST`s the binary file to R2 using the presigned URL.

---

### A.2 Complete Updated System Topology

```mermaid
graph TB
    %% ─── Client Layer ───────────────────────────────────────────────────
    subgraph Client ["Frontend Layer (SvelteKit / Node.js — Port 5173)"]
        UI["UI Components (Tailwind CSS)"]
        Router["SvelteKit Router (SSR / CSR)"]
        Tiptap["Tiptap Rich-Text Canvas\n(Articles & Gadya — /contribute/gadya)"]
        ProfilePage["/profile — Avatar & Cover Upload"]
        AdminPages["/admin/authors & /admin/works\n— Author / Work Cover Upload"]
        Stores["Svelte Stores (authStore, themeStore)"]
        Services["API Service Layer (api.ts)"]
        ImageSvc["imageUploadService.ts\n(Handles presign → upload → URL extraction)"]

        UI --> Router
        Router --> Tiptap
        Router --> ProfilePage
        Router --> AdminPages
        Router --> Stores
        Router --> Services
        Services --> ImageSvc
    end

    %% ─── Primary Backend ─────────────────────────────────────────────────
    subgraph Backend ["Backend Layer (FastAPI / Python 3.11 — Port 8000)"]
        Gateway["Uvicorn ASGI Server"]

        subgraph Middleware ["Middleware Stack"]
            CORS["CORSMiddleware (Strict Origins)"]
            Sec["SecurityHeadersMiddleware (CSP, HSTS)"]
            Activity["ActivityLoggingMiddleware"]
        end

        subgraph Routers ["API Routers (/api/v1/)"]
            R_Auth["/auth — JWT & OAuth2"]
            R_ImageToken["/images/upload-token\n🆕 Token issuance only\nReturns: presigned POST URL + fields"]
            R_Images["/images/confirm\n🆕 Persists returned URL to MySQL"]
            R_Users["/users — Profile & Avatar URL PATCH"]
            R_Authors["/authors — cover_image_url PATCH"]
            R_Works["/works — cover_image_url PATCH"]
            R_Content["/submissions & /moderation"]
            R_Admin["/admin"]
        end

        subgraph CoreServices ["Business Logic Services"]
            Svc_JWT["JWT & RBAC Engine"]
            Svc_R2["R2TokenService\n🆕 boto3/S3-compat presign logic"]
            Svc_Sub["SubmissionWorkflowService"]
        end

        Gateway --> CORS --> Sec --> Activity --> Routers
        Routers --> CoreServices
    end

    %% ─── Image Microservice (Sidecar) ────────────────────────────────────
    subgraph ImageEdge ["🆕 Image Microservice (Cloudflare Edge)"]
        Worker["Cloudflare Worker\n(Edge runtime — validates CORS origin,\nenforces max file size & MIME allowlist)"]
        R2[("Cloudflare R2 Bucket\nawadhi-media\n(S3-compatible object storage)")]
        CDN["Cloudflare CDN\n(Public URL: https://media.awadhi.in/*)"]

        Worker --> R2
        R2 --> CDN
    end

    %% ─── Database Layer ──────────────────────────────────────────────────
    subgraph Database ["Database Layer (MySQL 8.0 — 29 Tables)"]
        ORM["SQLAlchemy 2.0 ORM"]
        Alembic["Alembic Migrations"]
        DB[("MySQL InnoDB\nawadhi_platform")]

        ORM --> DB
        Alembic -.-> DB
    end

    %% ─── Inter-layer Connections ─────────────────────────────────────────
    Services -- "REST/JSON + JWT Bearer" --> Gateway
    ImageSvc -- "1. GET /api/v1/images/upload-token\n   (JWT authenticated)" --> R_ImageToken
    R_ImageToken --> Svc_JWT
    R_ImageToken --> Svc_R2
    Svc_R2 -- "boto3 presign_post\n(S3-compat API)" --> R2

    ImageSvc -- "2. POST presignedUrl\n   multipart/form-data (binary)\n   ← NO FastAPI involved" --> Worker

    ImageSvc -- "3. PATCH /api/v1/users/me or\n   /api/v1/authors/{id} or\n   /api/v1/works/{id}\n   body: { image_url: 'https://media.awadhi.in/...' }" --> Backend

    Backend --> ORM
    CDN -- "4. Served directly to browser\n   on subsequent page loads" --> Client

    style ImageEdge fill:#f0f4ff,stroke:#4a6fa5,stroke-width:2px
    style R_ImageToken fill:#e8f5e9,stroke:#388e3c
    style R_Images fill:#e8f5e9,stroke:#388e3c
    style Svc_R2 fill:#e8f5e9,stroke:#388e3c
    style ImageSvc fill:#e8f5e9,stroke:#388e3c
```

> **Legend:** 🆕 = net-new component added by this feature. Everything else is pre-existing v5.0 infrastructure.

---

## B. Three Separate Data Flow Sequences

### B.1 — Tiptap Editor Image Upload Flow

**Trigger:** User pastes an image (`paste` event) or drops a file (`drop` event) onto the Tiptap canvas at `/contribute/gadya` or `/contribute/article`.

**Tiptap Extension:** A custom `ImageUpload` Tiptap extension intercepts the browser event, preventing Tiptap's default inline-base64 embedding.

```mermaid
sequenceDiagram
    actor User as ✍️ Contributor
    participant Tiptap as Tiptap Canvas<br/>(ImageUpload Extension)
    participant ImageSvc as imageUploadService.ts
    participant FastAPI as FastAPI /api/v1/images/upload-token
    participant R2Worker as Cloudflare Worker + R2
    participant CDN as Cloudflare CDN<br/>(https://media.awadhi.in)
    participant SubAPI as FastAPI /api/v1/submissions/{id}

    User->>Tiptap: Pastes or drops image file
    Note over Tiptap: Intercepts event via custom<br/>ImageUpload extension.<br/>Extracts File object from DataTransfer.

    Tiptap->>ImageSvc: uploadImage(file, context='article')

    rect rgb(232, 245, 232)
        Note over ImageSvc,FastAPI: Step 1 — Token Request (JWT authenticated)
        ImageSvc->>FastAPI: GET /api/v1/images/upload-token<br/>Headers: Authorization: Bearer {jwt}<br/>Params: ?context=article&mime=image/webp&size=204800
        FastAPI->>FastAPI: Validate JWT → extract user_id & role<br/>Enforce max size (5 MB) & MIME allowlist<br/>(image/webp, image/jpeg, image/png, image/gif)
        FastAPI->>FastAPI: R2TokenService.generate_presigned_post(<br/>  bucket="awadhi-media",<br/>  key="articles/{user_id}/{uuid}.webp",<br/>  conditions=[content-length-range, mime],<br/>  expires=300  # 5 minutes<br/>)
        FastAPI-->>ImageSvc: 200 OK<br/>{ url: "https://awadhi-media.r2.cloudflarestorage.com",<br/>  fields: { key, policy, x-amz-signature, ... },<br/>  public_url: "https://media.awadhi.in/articles/{user_id}/{uuid}.webp" }
    end

    rect rgb(232, 240, 255)
        Note over ImageSvc,R2Worker: Step 2 — Direct Binary Upload (FastAPI bypassed entirely)
        ImageSvc->>ImageSvc: Build FormData:<br/>  Append all fields from presigned response<br/>  Append file as last field ("file")
        ImageSvc->>R2Worker: POST {presigned_url}<br/>Content-Type: multipart/form-data<br/>Body: {policy_fields... + binary_blob}
        Note over R2Worker: Cloudflare Worker validates:<br/>• Origin header matches allowlist<br/>• MIME type matches policy<br/>• File size within declared range<br/>• Signature not expired (TTL=300s)
        R2Worker->>R2Worker: Persists object to R2 bucket<br/>Path: articles/{user_id}/{uuid}.webp
        R2Worker-->>ImageSvc: 204 No Content (S3-compatible success)
    end

    rect rgb(255, 248, 225)
        Note over ImageSvc,Tiptap: Step 3 — URL Injection into Tiptap JSON
        ImageSvc-->>Tiptap: Returns public_url<br/>"https://media.awadhi.in/articles/{user_id}/{uuid}.webp"
        Tiptap->>Tiptap: editor.chain().focus()<br/>  .setImage({ src: public_url })<br/>  .run()
        Note over Tiptap: Tiptap JSON doc now contains:<br/>{ type: "image", attrs: { src: "https://media.awadhi.in/..." } }<br/>No base64 blob. No inline data URI.
    end

    rect rgb(255, 235, 235)
        Note over Tiptap,SubAPI: Step 4 — Autosave (URL persisted indirectly via Tiptap JSON)
        Tiptap->>SubAPI: PATCH /api/v1/submissions/{draft_id}<br/>body: { content_json: { ...tiptap_doc_with_image_url... } }
        Note over SubAPI: FastAPI saves the entire Tiptap JSON<br/>to submissions.content_json (TEXT/JSON column).<br/>The R2 URL is an embedded string inside that JSON —<br/>no separate image table entry needed.
        SubAPI-->>Tiptap: 200 OK — Draft autosaved
    end

    User->>Tiptap: Sees image rendered inline within 1-2 seconds
    Note over CDN: On next load, browser fetches<br/>img src directly from CDN —<br/>zero FastAPI involvement.
```

---

### B.2 — User Avatar / Profile Image Upload Flow

**Trigger:** User navigates to `/profile`, clicks "Change Avatar" or "Change Cover Photo", selects a file via `<input type="file">`.

```mermaid
sequenceDiagram
    actor User as 👤 Registered User
    participant ProfilePage as SvelteKit /profile<br/>(AvatarUpload.svelte component)
    participant ImageSvc as imageUploadService.ts
    participant TokenAPI as FastAPI /api/v1/images/upload-token
    participant R2Worker as Cloudflare Worker + R2
    participant UserAPI as FastAPI /api/v1/users/me
    participant DB as MySQL — users table

    User->>ProfilePage: Selects avatar image via file picker
    Note over ProfilePage: Validates client-side:<br/>• Max 2 MB<br/>• Accepts: image/jpeg, image/png, image/webp<br/>Shows local preview via URL.createObjectURL()

    ProfilePage->>ImageSvc: uploadImage(file, context='avatar')

    rect rgb(232, 245, 232)
        Note over ImageSvc,TokenAPI: Step 1 — Request Upload Token
        ImageSvc->>TokenAPI: GET /api/v1/images/upload-token<br/>Headers: Authorization: Bearer {jwt}<br/>Params: ?context=avatar&mime=image/webp&size=512000
        TokenAPI->>TokenAPI: Verify JWT (user must be authenticated)<br/>Generate presigned POST policy:<br/>  key: "avatars/{user_id}/avatar.webp"<br/>  Note: Fixed filename means new upload<br/>  automatically overwrites previous avatar<br/>  at the same R2 key — no orphan cleanup needed
        TokenAPI-->>ImageSvc: 200 OK<br/>{ url, fields, public_url:<br/>  "https://media.awadhi.in/avatars/{user_id}/avatar.webp" }
    end

    rect rgb(232, 240, 255)
        Note over ImageSvc,R2Worker: Step 2 — Direct Upload to R2 (FastAPI not in upload path)
        ImageSvc->>ImageSvc: Convert file to WebP client-side if browser supports<br/>Canvas API → toBlob('image/webp', 0.85)<br/>(Falls back to original format if Canvas API unavailable)
        ImageSvc->>R2Worker: POST {presigned_url}<br/>multipart/form-data: {fields} + file blob
        R2Worker->>R2Worker: Validates signature, MIME, size<br/>Writes object: avatars/{user_id}/avatar.webp
        R2Worker-->>ImageSvc: 204 No Content
    end

    rect rgb(255, 248, 225)
        Note over ImageSvc,UserAPI: Step 3 — Persist URL to MySQL via FastAPI
        ImageSvc-->>ProfilePage: Returns public_url
        ProfilePage->>UserAPI: PATCH /api/v1/users/me<br/>Headers: Authorization: Bearer {jwt}<br/>Body: { avatar_url: "https://media.awadhi.in/avatars/{user_id}/avatar.webp" }
        UserAPI->>UserAPI: Validate JWT → confirm user_id matches<br/>Update ORM model: user.avatar_url = avatar_url
        UserAPI->>DB: UPDATE users SET avatar_url = ? WHERE id = ?
        DB-->>UserAPI: Row updated (1 row affected)
        UserAPI-->>ProfilePage: 200 OK { avatar_url: "https://media.awadhi.in/..." }
    end

    ProfilePage->>ProfilePage: Replaces <img src> with new public_url<br/>URL.revokeObjectURL(localPreview) — cleanup
    User->>ProfilePage: Sees new avatar immediately (no page reload)
    Note over DB: users.avatar_url now holds a plain VARCHAR<br/>"https://media.awadhi.in/avatars/42/avatar.webp"<br/>Every page that renders this user reads that column directly.
```

---

### B.3 — Admin Author / Work Cover Upload Flow

**Trigger:** Admin navigates to `/admin/authors` or `/admin/works`, opens an entity's edit panel, and uploads a cover image.

**Security context:** Requires `role = admin` or `role = senior_moderator`. RBAC enforced by FastAPI dependency injection (`require_admin` guard on the token endpoint and the PATCH endpoint).

```mermaid
sequenceDiagram
    actor Admin as 🛡️ Admin / Sr. Moderator
    participant AdminPage as SvelteKit /admin/authors<br/>or /admin/works
    participant ImageSvc as imageUploadService.ts
    participant TokenAPI as FastAPI /api/v1/images/upload-token
    participant R2Worker as Cloudflare Worker + R2
    participant AuthorAPI as FastAPI /api/v1/authors/{id}<br/>or /api/v1/works/{id}
    participant DB as MySQL — authors / works tables

    Admin->>AdminPage: Opens Author edit panel, selects cover image
    Note over AdminPage: Entity detail form shows current<br/>cover_image_url (or placeholder).<br/>File input: accepts image/*, max 10 MB

    AdminPage->>ImageSvc: uploadImage(file, context='cover', entityType='author', entityId=42)

    rect rgb(232, 245, 232)
        Note over ImageSvc,TokenAPI: Step 1 — Admin-Scoped Token Request
        ImageSvc->>TokenAPI: GET /api/v1/images/upload-token<br/>Headers: Authorization: Bearer {admin_jwt}<br/>Params: ?context=cover&entity_type=author&entity_id=42&mime=image/jpeg&size=2048000
        TokenAPI->>TokenAPI: Verify JWT + assert role ∈ {admin, senior_moderator}<br/>Returns 403 if insufficient role.<br/>Generate presigned POST policy:<br/>  key: "covers/authors/42/cover.jpg"<br/>  Conditions: max 10 MB, MIME image/*<br/>  TTL: 300 seconds
        TokenAPI-->>ImageSvc: 200 OK<br/>{ url, fields, public_url:<br/>  "https://media.awadhi.in/covers/authors/42/cover.jpg" }
    end

    rect rgb(232, 240, 255)
        Note over ImageSvc,R2Worker: Step 2 — Binary Upload Direct to R2
        ImageSvc->>R2Worker: POST {presigned_url}<br/>multipart/form-data: {policy_fields} + cover_image_blob
        Note over R2Worker: Enforces CORS to awadhi.in origin only.<br/>Content-Type validated against policy.<br/>Size validated against declared range (0 – 10 MB).
        R2Worker->>R2Worker: Persists object: covers/authors/42/cover.jpg
        R2Worker-->>ImageSvc: 204 No Content
    end

    rect rgb(255, 248, 225)
        Note over ImageSvc,AuthorAPI: Step 3 — Persist URL via Authenticated PATCH
        ImageSvc-->>AdminPage: Returns public_url
        AdminPage->>AuthorAPI: PATCH /api/v1/authors/42<br/>Headers: Authorization: Bearer {admin_jwt}<br/>Body: { cover_image_url: "https://media.awadhi.in/covers/authors/42/cover.jpg" }
        Note over AuthorAPI: require_admin dependency re-validates JWT.<br/>Prevents URL injection by non-admins — only<br/>the confirmed owner of that role can set this field.
        AuthorAPI->>AuthorAPI: ORM: author.cover_image_url = cover_image_url
        AuthorAPI->>DB: UPDATE authors<br/>SET cover_image_url = ?,<br/>    updated_at = NOW()<br/>WHERE id = 42
        DB-->>AuthorAPI: Transaction committed
        AuthorAPI-->>AdminPage: 200 OK { id: 42, cover_image_url: "https://..." }
    end

    AdminPage->>AdminPage: Updates preview image in entity card<br/>Shows toast: "Cover image updated successfully"
    Admin->>AdminPage: Confirms new cover visible in admin panel

    Note over DB: authors.cover_image_url is a plain VARCHAR(500)<br/>No JOIN, no foreign key, no image metadata table.<br/>The public CDN URL is the single source of truth.
```

---

## C. URL Lifecycle

### C.1 The Complete Journey of One URL

```
"https://media.awadhi.in/avatars/42/avatar.webp"
```

| Phase | What Happens | Where |
|:---|:---|:---|
| **1. Generation** | `R2TokenService.generate_presigned_post()` computes the deterministic public URL from the bucket name + object key. The URL is returned to the client in the token response *before* the file is even uploaded. | FastAPI — `R2TokenService` |
| **2. Object Creation** | Client uploads binary to R2 via presigned POST. R2 creates the object at the declared key. The public URL is now resolvable. | Cloudflare R2 Bucket |
| **3. Persistence** | Client sends the URL as a plain string in a JSON body to FastAPI. FastAPI writes it to MySQL via SQLAlchemy ORM. No image metadata, no file size, no EXIF — just the URL string. | FastAPI → MySQL `VARCHAR(500)` |
| **4. CDN Serving** | On all subsequent page loads, the client receives the URL from the API response and sets it as `<img src="...">`. The browser fetches the image directly from Cloudflare's CDN. FastAPI is not in this path at all. | Cloudflare CDN → Browser |
| **5. Cache** | Cloudflare's edge network caches the image globally. `Cache-Control: public, max-age=31536000, immutable` is set on R2 objects. Deterministic file paths (e.g. `avatar.webp`) are busted by uploading a new file to the same key. | Cloudflare Edge PoPs |

### C.2 MySQL Storage — Column Reality

```sql
-- No new table is created. The URL drops into existing columns:

-- users table (already exists, column added via Alembic migration)
ALTER TABLE users
  ADD COLUMN avatar_url VARCHAR(500) NULL,
  ADD COLUMN cover_image_url VARCHAR(500) NULL;

-- authors table (already exists)
ALTER TABLE authors
  ADD COLUMN cover_image_url VARCHAR(500) NULL;

-- works table (already exists)
ALTER TABLE works
  ADD COLUMN cover_image_url VARCHAR(500) NULL;

-- submissions table: content_json (TEXT) already stores the
-- full Tiptap JSON document. The R2 URL lives embedded in that
-- JSON as an image node's `src` attribute. No column change needed
-- for Tiptap editor images.
```

> [!IMPORTANT]
> **No foreign key. No image metadata table. No file-size column.** The R2 URL is treated identically to how a CMS like WordPress stores an `_wp_attachment_url` post meta: a plain string that the CDN resolves. This is intentional (see §D).

### C.3 Page Load — Read Path (Zero Image Overhead on FastAPI)

```mermaid
sequenceDiagram
    participant Browser
    participant SvelteKit as SvelteKit SSR/CSR
    participant FastAPI as FastAPI /api/v1/authors/42
    participant DB as MySQL
    participant CDN as Cloudflare CDN

    Browser->>SvelteKit: GET /authors/tulsidas
    SvelteKit->>FastAPI: GET /api/v1/authors/42
    FastAPI->>DB: SELECT id, name_devanagari, cover_image_url FROM authors WHERE id = 42
    DB-->>FastAPI: { id: 42, cover_image_url: "https://media.awadhi.in/covers/authors/42/cover.jpg" }
    FastAPI-->>SvelteKit: 200 OK { ...author, cover_image_url: "https://..." }
    SvelteKit-->>Browser: Renders HTML with <img src="https://media.awadhi.in/...">
    Browser->>CDN: GET https://media.awadhi.in/covers/authors/42/cover.jpg
    CDN-->>Browser: Binary image (served from Cloudflare edge PoP, not origin)
    Note over FastAPI: FastAPI never touches image bytes<br/>on read or write paths.
```

---

## D. Key Architectural Decisions

### D.1 Why Binary Payloads Bypass FastAPI

**The core problem with naïve image upload via FastAPI:**

```python
# What we are NOT doing — Anti-pattern
@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()  # Entire binary blob into Python heap
    # Blocks Uvicorn worker thread during I/O
    # Doubles bandwidth (client → server → R2)
    # Memory spike per concurrent upload
    s3_client.put_object(Body=contents, ...)
```

This approach means:
- Every 5 MB avatar upload allocates 5 MB of RAM inside the Uvicorn ASGI worker.
- With 20 concurrent uploads, that's 100 MB of heap pressure on the Python process.
- The binary is transmitted twice: client → FastAPI → R2. Double egress cost.
- Uvicorn's default worker count is CPU-bound; blocking on large I/O starves API calls.

**The presigned-POST solution:**

```
Client ──(JWT)──► FastAPI ──► [generates 300-byte JSON token] ──► Client
Client ──(5MB binary)──────────────────────────────────────────► R2 directly
```

FastAPI's involvement is `O(1)` per upload: one tiny JSON payload, no binary I/O, no memory pressure. The binary transfer is offloaded entirely to Cloudflare's infrastructure.

---

### D.2 FastAPI's Role: Token Issuance Only

The `R2TokenService` has exactly one job in the upload path:

```python
# backend/app/services/r2_token_service.py (to be created)
import boto3
from botocore.client import Config
from app.core.settings import settings

class R2TokenService:
    def __init__(self):
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,         # https://{account_id}.r2.cloudflarestorage.com
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    def generate_presigned_post(
        self,
        key: str,
        mime_type: str,
        max_size_bytes: int,
        expires_in: int = 300,
    ) -> dict:
        """
        Returns a presigned POST URL + policy fields.
        The client uses these to upload directly to R2.
        FastAPI never sees the binary payload.
        """
        return self._client.generate_presigned_post(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Fields={"Content-Type": mime_type},
            Conditions=[
                {"Content-Type": mime_type},
                ["content-length-range", 1, max_size_bytes],
            ],
            ExpiresIn=expires_in,
        )
```

The endpoint that calls this service is intentionally thin:

```python
# GET /api/v1/images/upload-token
@router.get("/images/upload-token")
async def get_upload_token(
    context: Literal["article", "avatar", "cover"],
    mime: str,
    size: int,
    current_user: User = Depends(get_current_user),
    r2: R2TokenService = Depends(get_r2_service),
):
    # 1. Validate MIME allowlist
    # 2. Validate max size per context
    # 3. Build deterministic key (e.g. avatars/{user_id}/avatar.webp)
    # 4. Call R2TokenService → return presigned data
    # FastAPI's work ends here. ~5ms total.
    ...
```

---

### D.3 Why This Keeps the Database Lightweight

| Design Choice | Alternative | Why Avoided |
|:---|:---|:---|
| Store URL as `VARCHAR(500)` in existing table column | Separate `images` metadata table with FK | FK table would require JOIN on every author/user query. Images don't need relational integrity — if an R2 object is deleted, the URL becomes a 404, which is acceptable and observable. |
| Deterministic, fixed-path keys (`avatars/{user_id}/avatar.webp`) | UUID per upload, stored in DB | Fixed paths make overwrites implicit — uploading a new avatar automatically replaces the old one at the same CDN URL. No orphan-cleanup cron needed. No URL update query needed (URL is stable). |
| No EXIF/metadata stored in MySQL | Store width, height, format, file size in DB | The platform's use-cases don't need image metadata for rendering decisions. The CDN serves the image; the browser's `<img>` tag handles layout. Storing metadata adds schema surface area for zero functional benefit at current scale. |
| Tiptap images embedded as URL strings in `content_json` | Separate junction table `submission_images(submission_id, image_url)` | Junction table would require separate migration and query. The Tiptap JSON document is already the ground truth for article content. The URL is just another attribute of an image node within that document. |

---

### D.4 Security Boundaries

```mermaid
graph LR
    A["Browser"] -- "1. JWT required for token" --> B["FastAPI Token Endpoint"]
    B -- "2. Presigned POST (HMAC-signed, 5-min TTL)" --> A
    A -- "3. POST binary to R2\n(no JWT needed — policy is the auth)" --> C["R2 via Cloudflare Worker"]
    C -- "4. Validates HMAC signature\nMIME type\nFile size\nOrigin header" --> D["R2 Bucket"]
    A -- "5. JWT required for URL persistence" --> E["FastAPI PATCH Endpoint"]
    E -- "6. Writes URL to MySQL" --> F[("MySQL")]

    style B fill:#d4edda
    style E fill:#d4edda
    style C fill:#cce5ff
```

**Threat mitigations:**

| Threat | Mitigation |
|:---|:---|
| Unauthenticated upload token request | Token endpoint requires valid JWT (`get_current_user` dependency) |
| Token replay attack | Presigned POST policy has 5-minute TTL; HMAC signature is single-use-scoped |
| Uploading to arbitrary R2 keys | Key is constructed server-side from `user_id` + `context`; client cannot influence the path |
| Injecting arbitrary URLs into user/author records | PATCH endpoints require JWT; the `image_url` field is validated to match the platform's R2 public URL prefix (`https://media.awadhi.in/`) |
| Storing malicious file content | Cloudflare Worker enforces MIME allowlist; R2 does not execute stored content |
| Cross-origin token abuse | Cloudflare Worker checks `Origin` header against the platform's domain allowlist |

---

## Appendix: New Environment Variables Required

```bash
# backend/.env additions
R2_ENDPOINT_URL=https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2_api_token_key_id>
R2_SECRET_ACCESS_KEY=<r2_api_token_secret>
R2_BUCKET_NAME=awadhi-media
R2_PUBLIC_URL_BASE=https://media.awadhi.in

# frontend/.env additions
PUBLIC_IMAGE_UPLOAD_CONTEXT_ARTICLE=article
PUBLIC_IMAGE_UPLOAD_CONTEXT_AVATAR=avatar
PUBLIC_IMAGE_UPLOAD_CONTEXT_COVER=cover
```

## Appendix: Schema Migrations Required

```
SCHEMA CHANGE
Table(s):     users
Change:       Add columns avatar_url VARCHAR(500) NULL,
              cover_image_url VARCHAR(500) NULL
Reason:       Store Cloudflare R2 public URLs for user profile images
Migration:    alembic/versions/<rev>_add_user_image_urls.py
Reversible:   Yes (downgrade drops both columns)

SCHEMA CHANGE
Table(s):     authors
Change:       Add column cover_image_url VARCHAR(500) NULL
Reason:       Store Cloudflare R2 public URL for author cover art
Migration:    alembic/versions/<rev>_add_author_cover_image_url.py
Reversible:   Yes

SCHEMA CHANGE
Table(s):     works
Change:       Add column cover_image_url VARCHAR(500) NULL
Reason:       Store Cloudflare R2 public URL for work cover art
Migration:    alembic/versions/<rev>_add_work_cover_image_url.py
Reversible:   Yes
```

> [!NOTE]
> Tiptap article images require **zero schema migrations** — the R2 URL embeds naturally inside the existing `submissions.content_json` TEXT column as part of the Tiptap document node tree.
