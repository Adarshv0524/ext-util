# Section 4: Security & Optimization
### Awadhi Literature Platform — Decoupled Image Upload Microservice

> **Stack anchor:** SvelteKit frontend · SvelteKit/Cloudflare D1 backend · Cloudflare R2 storage · Cloudflare Workers edge layer  
> **Auth anchor:** Existing `Role` hierarchy (`guest → contributor → moderator → admin`) and `role_at_least()` from `app/core/permissions.py`. Rate-limit infrastructure: `rate_limit_counters` table + `app/services/rate_limit.py` `check_and_increment()`.

---

## A. Presigned URL Security Model

### A.1 — Why Presigned PUT URLs Are Safer Than Proxying Through SvelteKit

Proxying uploads through SvelteKit means every byte of every image passes through the application server's memory before reaching R2. This creates four compounding risks:

| Risk | Proxy Through SvelteKit | Presigned PUT Direct to R2 |
|---|---|---|
| **Memory exhaustion** | Server must buffer the entire file (a 10 MB avatar = 10 MB heap) | Server only touches the token JSON — zero file bytes |
| **Request timeout window** | Slow uploaders hold a Uvicorn worker thread open for the full upload duration | Upload thread is owned by R2's CDN edge — SvelteKit's worker is freed at token issuance |
| **Amplified attack surface** | A malicious multipart body can probe SvelteKit's parser, trigger OOM, or bypass size limits via chunked encoding tricks | R2's S3-compatible endpoint enforces Content-Length independently at its own edge |
| **Logging of file bytes** | Body may partially appear in error logs, Sentry payloads, or middleware inspection (GDPR risk) | Only the object key and metadata are ever visible to the application tier |

The presigned PUT model also provides a natural audit boundary: SvelteKit authorizes *who may upload* and *what type*, but the actual byte stream flows directly from the browser to Cloudflare's network — two concerns that should never have been on the same server.

---

### A.2 — Token Expiry: Why 5 Minutes

```python
PRESIGNED_URL_TTL_SECONDS = 300  # 5 minutes
```

**Justification:**

- **Minimum viable window:** A typical browser upload of a 5–10 MB cover image on a 4G connection (~5–10 Mbps) completes in under 10 seconds. 5 minutes is 30× headroom — large enough for slow connections and retries, small enough to make a stolen URL economically worthless.
- **Replay window:** If a URL is intercepted (e.g., via a shared clipboard, a misconfigured proxy log), the attacker has at most 300 seconds to use it before R2 rejects it at the S3-policy level. Contrast with a 24-hour URL, which survives an entire work day of exposure.
- **KV one-time-use compatibility:** The Cloudflare KV TTL on the usage flag must be >= the presigned TTL. Setting both to 300s means the KV entry auto-expires without manual cleanup, eliminating a class of GC bugs.
- **JWT expiry alignment:** If the user's session JWT expires during upload (unlikely with a 1-hour session window, but theoretically possible during a long-idle browser tab), the presigned URL is already invalid — preventing ghost uploads from logged-out sessions.

> [!WARNING]
> Do not use `expires_in=3600` (1 hour) as the boto3 default suggests. At 1 hour, a URL leaked in a Slack message, browser history sync, or access log remains exploitable for the full session lifetime of a typical user.

---

### A.3 — One-Time-Use Enforcement via Cloudflare KV

The S3 presigned URL spec does not natively enforce single-use. An attacker who intercepts a valid URL can re-upload a different payload to the same key within the TTL window. KV usage-flag enforcement closes this gap.

**Flow:**

```
1. SvelteKit issues presigned URL -> writes KV entry:
   Key:   "otpu:{object_key}"          (otpu = one-time-presigned-url)
   Value: "pending"
   TTL:   300 seconds

2. Cloudflare Worker intercepts the PUT to R2:
   a. Read KV("otpu:{object_key}") -> must equal "pending"
   b. Atomically set KV("otpu:{object_key}") = "used"  <- second PUT sees "used" -> 409
   c. Allow the PUT to pass through to R2

3. On second attempt with the same URL:
   Worker reads KV = "used" -> returns HTTP 409 Conflict
   (URL is cryptographically valid per S3 policy, but Worker blocks it at the edge)
```

**Cloudflare Worker snippet:**

```javascript
// workers/upload-guard/index.js
export default {
  async fetch(request, env) {
    if (request.method !== 'PUT') return env.R2_BUCKET.fetch(request);

    const url = new URL(request.url);
    const objectKey = url.pathname.slice(1); // strip leading slash
    const kvKey = `otpu:${objectKey}`;

    const existing = await env.UPLOAD_KV.get(kvKey);

    if (existing === null) {
      return new Response('Upload token not recognized', { status: 403 });
    }
    if (existing === 'used') {
      return new Response('Upload token already consumed', { status: 409 });
    }

    // Mark as used BEFORE forwarding
    await env.UPLOAD_KV.put(kvKey, 'used', { expirationTtl: 300 });

    return env.R2_BUCKET.fetch(request);
  }
};
```

> [!NOTE]
> KV is eventually consistent. In the rare case of two simultaneous PUTs, both reads may see "pending" before either write completes. For avatars and covers this is acceptable (last-write-wins on R2 is harmless). If strict once-only is ever required, replace KV with a Durable Object that serializes the CAS.

---

### A.4 — HMAC-SHA256 Token Binding

The presigned URL alone authenticates *the URL*. The HMAC token binds the URL to a specific *user, MIME type, and expiry* — meaning a URL stolen from user A cannot be used by user B.

**Payload structure:**

```
{object_key}:{user_id}:{mime_type}:{expires_at}
```

Example:
```
avatars/usr_42/01HZRTK.webp:42:image/webp:1753521600
```

**Signing (SvelteKit):**

```python
# app/services/media_token.py
import hmac
import hashlib
import time
from app.core.settings import settings

PRESIGNED_URL_TTL = 300  # seconds

def generate_upload_token(object_key: str, user_id: int, mime_type: str) -> dict:
    expires_at = int(time.time()) + PRESIGNED_URL_TTL
    payload = f"{object_key}:{user_id}:{mime_type}:{expires_at}"
    signature = hmac.new(
        settings.MEDIA_HMAC_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return {
        "object_key": object_key,
        "expires_at": expires_at,
        "signature": signature,
    }

def verify_upload_token(
    object_key: str, user_id: int, mime_type: str,
    expires_at: int, signature: str
) -> bool:
    if int(time.time()) > expires_at:
        return False  # expired
    payload = f"{object_key}:{user_id}:{mime_type}:{expires_at}"
    expected = hmac.new(
        settings.MEDIA_HMAC_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)  # constant-time
```

**Settings addition** (extends existing `Settings` class per backend standards §1):

```python
MEDIA_HMAC_SECRET: str = Field(..., description="Secret for HMAC-SHA256 upload token signing")
R2_ACCESS_KEY_ID: str = ""
R2_SECRET_ACCESS_KEY: str = ""
R2_BUCKET_NAME: str = ""
R2_ACCOUNT_ID: str = ""
R2_PUBLIC_BASE_URL: str = ""  # e.g. https://images.awadhi.com
```

> [!IMPORTANT]
> `MEDIA_HMAC_SECRET` must be added to the `validate_production` model validator — fail startup if unset in production, consistent with the existing `JWT_SECRET_KEY` / `MYSQL_PASSWORD` checks.

---

## B. File Validation Layers (Defense in Depth)

### Overview

No single validation layer is sufficient. The defense-in-depth model treats each layer as independently bypassable and requires the next layer to catch what the previous missed.

```
Browser --[L1]--> SvelteKit --[L2]--> Cloudflare Worker --[L3]--> R2 --[L4 post-upload]-->
```

---

### Layer 1 — Client-Side (SvelteKit)

**Purpose:** Immediate UX feedback. Not a security control — a motivated attacker removes this entirely.

```typescript
// lib/media/validate-upload.ts
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'
]);

const SIZE_LIMITS: Record<string, number> = {
  avatar:        2 * 1024 * 1024,   //  2 MB
  author_cover: 10 * 1024 * 1024,   // 10 MB
  work_cover:   10 * 1024 * 1024,   // 10 MB
  article_image: 5 * 1024 * 1024,   //  5 MB
};

export function validateFile(file: File, assetType: string): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return `File type "${file.type}" is not allowed.`;
  }
  const limit = SIZE_LIMITS[assetType] ?? 5 * 1024 * 1024;
  if (file.size > limit) {
    return `File exceeds the ${limit / 1024 / 1024} MB limit for ${assetType}.`;
  }
  return null; // valid
}
```

> [!NOTE]
> `file.type` is sourced from the browser's MIME sniffing of the filename extension — it is trivially spoofed. This layer exists to catch accidental mistakes, not malicious actors.

---

### Layer 2 — SvelteKit (Authorization & Policy Gate)

**Purpose:** Authoritative policy enforcement. Rejects requests before a presigned URL is ever generated. This is the first security-enforcing layer.

```python
# app/schemas/media.py
from pydantic import BaseModel, field_validator
from typing import Literal

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"
}

ASSET_SIZE_LIMITS = {   # bytes
    "avatar":        2 * 1024 * 1024,
    "author_cover": 10 * 1024 * 1024,
    "work_cover":   10 * 1024 * 1024,
    "article_image": 5 * 1024 * 1024,
}

class UploadRequestSchema(BaseModel):
    asset_type: Literal["avatar", "author_cover", "work_cover", "article_image"]
    mime_type: str
    file_size: int  # declared by the client; checked against server policy

    @field_validator("mime_type")
    @classmethod
    def validate_mime(cls, v: str) -> str:
        if v not in ALLOWED_MIME_TYPES:
            raise ValueError(f"MIME type '{v}' is not permitted")
        return v

    @field_validator("file_size")
    @classmethod
    def validate_size(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("file_size must be positive")
        return v
```

```python
# app/api/v1/media.py  (router excerpt)
from app.core.permissions import role_at_least, Role

@router.post("/upload-token")
async def request_upload_token(
    body: UploadRequestSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # RBAC: guests cannot upload
    if not role_at_least(current_user.role, Role.CONTRIBUTOR):
        raise HTTPException(status_code=403, detail="Upload requires Contributor role or higher")

    # Per-asset-type size cap (server-authoritative)
    max_size = ASSET_SIZE_LIMITS[body.asset_type]
    if body.file_size > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File size {body.file_size} exceeds {max_size} bytes for {body.asset_type}"
        )

    # Rate limit (uses existing check_and_increment infrastructure)
    upload_limit = UPLOAD_RATE_LIMITS[current_user.role]
    allowed, retry_after = check_and_increment(
        db, current_user.id, None,
        action_key="media:upload",
        window_seconds=3600,
        limit=upload_limit,
        granularity=DEFAULT_RATE_LIMIT_GRANULARITY_SECONDS,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            detail=f"Upload rate limit exceeded. Retry after {retry_after}s."
        )

    # Generate object key, presigned URL, HMAC token, register KV
    ...
```

---

### Layer 3 — Cloudflare Worker (Edge Enforcement)

**Purpose:** Re-validates Content-Length and performs magic-byte MIME verification before bytes reach R2. This is the only layer that sees actual file bytes.

```javascript
// workers/upload-guard/index.js
const MAGIC_BYTES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // "RIFF" -- also verify bytes 8-11 = "WEBP"
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],  // "GIF8"
  'image/avif': [[0x00, 0x00, 0x00]],         // ftyp box -- offset check needed
};

const SIZE_LIMITS = {
  avatar: 2 * 1024 * 1024,
  author_cover: 10 * 1024 * 1024,
  work_cover: 10 * 1024 * 1024,
  article_image: 5 * 1024 * 1024,
};

function checkMagicBytes(buffer, mimeType) {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return false;
  return signatures.some(sig =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

export default {
  async fetch(request, env) {
    if (request.method !== 'PUT') return env.R2_BUCKET.fetch(request);

    const url = new URL(request.url);
    const objectKey = url.pathname.slice(1);

    // 1. One-time-use KV check
    const kvKey = `otpu:${objectKey}`;
    const existing = await env.UPLOAD_KV.get(kvKey);
    if (existing !== 'pending') {
      const status = existing === 'used' ? 409 : 403;
      return new Response(existing === 'used' ? 'Token already consumed' : 'Unrecognized token', { status });
    }
    await env.UPLOAD_KV.put(kvKey, 'used', { expirationTtl: 300 });

    // 2. Content-Length enforcement
    const contentLength = parseInt(request.headers.get('Content-Length') || '0');
    const assetType = url.searchParams.get('x-asset-type') || 'article_image';
    const maxSize = SIZE_LIMITS[assetType] ?? 5 * 1024 * 1024;
    if (contentLength > maxSize) {
      return new Response(`File too large: ${contentLength} > ${maxSize}`, { status: 413 });
    }

    // 3. Magic-byte MIME check (read first 16 bytes only)
    const clonedRequest = request.clone();
    const reader = clonedRequest.body.getReader();
    const { value: firstChunk } = await reader.read();
    reader.cancel();

    const declaredMime = request.headers.get('Content-Type') || '';
    if (!checkMagicBytes(new Uint8Array(firstChunk), declaredMime)) {
      return new Response('File content does not match declared MIME type', { status: 415 });
    }

    return env.R2_BUCKET.fetch(request);
  }
};
```

> [!NOTE]
> The AVIF magic-byte check requires reading the `ftyp` box at byte offset 4-11. Harden this before shipping: verify bytes 4-7 spell `ftyp` and bytes 8-11 contain `avif` or `avis`.

---

### Layer 4 — Post-Upload (Async Verification)

**Purpose:** Catches what no synchronous layer can: MIME polyglots, CSAM, hash-based deduplication.

```python
# app/workers/post_upload_verify.py
import hashlib
import httpx

async def verify_uploaded_object(object_key: str, db: Session) -> None:
    """
    Called by /confirm endpoint after is_committed=True.
    Runs as BackgroundTask -- does not block HTTP response.
    """
    r2_url = f"{settings.R2_INTERNAL_BASE_URL}/{object_key}"
    async with httpx.AsyncClient() as client:
        response = await client.get(r2_url)
        file_bytes = response.content

    # SHA-256 hash for deduplication / audit trail
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    db.execute(
        text("UPDATE media_uploads SET file_hash = :h WHERE object_key = :k"),
        {"h": file_hash, "k": object_key}
    )
    db.commit()

    # CSAM check (PhotoDNA / Project Arachnid) -- FUTURE
    # if settings.PHOTODNA_API_KEY:
    #     await submit_to_photodna(file_bytes, object_key)
```

> [!IMPORTANT]
> CSAM scanning is marked `# FUTURE`. Before enabling public uploads (beyond authenticated contributors), this becomes a legal requirement in many jurisdictions. **Log to `TECH_DEBT.md` as Medium severity now** so it is tracked and not silently skipped.

---

### B.5 — Threat Model Table

| Attack Vector | Layer Blocked At | Mitigation Detail |
|---|---|---|
| Client sends wrong MIME in `file.type` field | **L2 — SvelteKit** | MIME whitelist on `UploadRequestSchema`; L1 already flags it for UX |
| Client sends oversized file | **L2 + L3** | L2 checks declared `file_size`; L3 Worker checks actual `Content-Length` |
| Attacker repurposes presigned URL for different MIME type | **L3 — Worker** | Magic-byte check; `Content-Type` must match actual bytes |
| Attacker replays presigned URL (second upload to same key) | **L3 — Worker** | KV one-time-use flag set to `"used"` after first PUT -> 409 on replay |
| Attacker forges upload token for different user's object key | **L2 — SvelteKit** | HMAC-SHA256 binding ties `object_key:user_id:mime_type:expires_at`; forgery requires `MEDIA_HMAC_SECRET` |
| MIME polyglot (JPEG containing PHP bytecode) | **L4 — Post-upload** | Full file hash + optional deep content scanning |
| Guest / unauthenticated upload attempt | **L2 — SvelteKit** | `role_at_least(Role.CONTRIBUTOR)` check before any token issuance |
| Upload rate abuse (bulk object pollution) | **L2 + CF WAF** | SvelteKit `check_and_increment` per user; Cloudflare per-IP rate limit at edge |
| Object key path traversal (`../etc/passwd`) | **L2 — SvelteKit** | Object key is generated server-side (UUID-based) — client never supplies the key |
| R2 bucket public read of uncommitted files | **R2 policy** | Staging objects under `staging/` prefix — CDN rule blocks public reads until `is_committed=true` |
| SSRF via presigned URL | **N/A** | Server only generates presigned URLs, never fetches them — vector does not exist in this flow |

---

## C. Rate Limiting Strategy

### C.1 — SvelteKit Per-User Limits

The existing `check_and_increment()` in `app/services/rate_limit.py` handles the Cloudflare D1 sliding-window logic. The media router reuses it with a dedicated `action_key`.

```python
# app/core/constants.py -- additions
UPLOAD_RATE_LIMIT_WINDOW_SECONDS = 3600   # 1 hour window

UPLOAD_RATE_LIMITS = {
    Role.CONTRIBUTOR: 20,   # 20 uploads/hour -- enough for an active article session
    Role.MODERATOR:   50,   # moderators may process cover art for many entries
    Role.ADMIN:      200,   # admins bulk-upload platform assets
}
```

**Usage in the router:**

```python
upload_limit = UPLOAD_RATE_LIMITS.get(current_user.role, 20)
allowed, retry_after = check_and_increment(
    db,
    user_id=current_user.id,
    ip_address=None,          # user-keyed, not IP-keyed at this layer
    action_key="media:upload",
    window_seconds=UPLOAD_RATE_LIMIT_WINDOW_SECONDS,
    limit=upload_limit,
    granularity=DEFAULT_RATE_LIMIT_GRANULARITY_SECONDS,
)
```

> [!TIP]
> The `action_key="media:upload"` namespace is intentionally flat. For per-asset-type limits in the future (e.g., avatars limited to 3/hour regardless of role), use `action_key=f"media:upload:{body.asset_type}"` with a separate constant map — no schema change required.

### C.2 — Role-Based Limit Matrix

| Role | Uploads / Hour | Max File Size | Asset Types Permitted |
|---|---|---|---|
| `guest` | 0 (blocked at RBAC) | — | None |
| `contributor` | 20 | 10 MB (work_cover) | All |
| `moderator` | 50 | 10 MB | All |
| `admin` | 200 | 10 MB | All + system assets |

### C.3 — Cloudflare Per-IP Rate Limiting

Enforced at the Cloudflare zone level (WAF Rules), not in the Worker, so it applies before any compute runs.

**Cloudflare Rate Limiting Rule (dashboard config):**

```
Rule name:   media-upload-per-ip
Expression:  (http.request.method eq "POST") and
             (http.request.uri.path eq "/api/v1/media/upload-token")
Action:      Block
Rate:        60 requests per 10 minutes per IP
Fingerprint: ip.src
```

**Why two separate layers?** The per-IP Cloudflare rule defends against credential-stuffing where many accounts share one attacking IP. The per-user SvelteKit limit defends against a single compromised account being abused via proxy rotation. Neither alone is sufficient.

---

## D. Orphaned Image Cleanup

### D.1 — Definition of Orphaned

An upload record in `media_uploads` is **orphaned** when:

```sql
is_committed = FALSE  AND  expires_at < NOW()
```

The `expires_at` field is set at token-issuance time to `NOW() + PRESIGNED_URL_TTL + COMMIT_GRACE_PERIOD`.

```python
COMMIT_GRACE_PERIOD_SECONDS = 120   # 2 minutes extra beyond URL TTL

expires_at = datetime.now(timezone.utc) + timedelta(
    seconds=PRESIGNED_URL_TTL + COMMIT_GRACE_PERIOD_SECONDS
)
# Total window: 7 minutes (5 min URL TTL + 2 min grace for slow networks/retries)
```

### D.2 — APScheduler Cron in SvelteKit

```python
# app/core/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

def start_scheduler():
    scheduler.add_job(
        cleanup_orphaned_uploads,
        trigger=CronTrigger(minute=0),  # top of every hour
        id="cleanup_orphaned_uploads",
        replace_existing=True,
        misfire_grace_time=300,         # catch up within 5 min if server was down
    )
    scheduler.start()
    logger.info("APScheduler started -- orphan cleanup registered (hourly)")
```

**Registration in `app/main.py` lifespan handler:**

```python
from contextlib import asynccontextmanager
from app.core.scheduler import start_scheduler, scheduler

@asynccontextmanager
async def lifespan(app: SvelteKit):
    start_scheduler()
    yield
    scheduler.shutdown()

app = SvelteKit(lifespan=lifespan)
```

### D.3 — Cron SQL + R2 Deletion Logic

```python
# app/tasks/cleanup_orphans.py
import boto3
from botocore.config import Config
from sqlalchemy import text
from app.db.session import SessionLocal
from app.core.settings import settings
import logging

logger = logging.getLogger(__name__)

def _get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )

def cleanup_orphaned_uploads() -> None:
    """
    Runs hourly. Two passes:
      1. Uncommitted uploads past grace period (never confirmed by client).
      2. Tiptap article images committed but abandoned (no live article references them).
    Raw SQL throughout: bulk operation, N+1 avoidance per backend standards section 6.
    """
    db = SessionLocal()
    r2 = _get_r2_client()

    try:
        # --- Pass 1: Pure orphans (never committed) ---
        rows = db.execute(text("""
            SELECT id, object_key
            FROM   media_uploads
            WHERE  is_committed = FALSE
              AND  expires_at < NOW()
            LIMIT  500
        """)).fetchall()

        if rows:
            ids         = [r[0] for r in rows]
            object_keys = [r[1] for r in rows]

            # Batch-delete from R2 (max 1000 per delete_objects call)
            r2.delete_objects(
                Bucket=settings.R2_BUCKET_NAME,
                Delete={"Objects": [{"Key": k} for k in object_keys], "Quiet": True}
            )
            # Delete DB records AFTER confirmed R2 deletion
            db.execute(
                text("DELETE FROM media_uploads WHERE id IN :ids"),
                {"ids": tuple(ids)}
            )
            db.commit()
            logger.info(
                "[orphan_cleanup] Deleted %d uncommitted uploads",
                len(ids),
                extra={"object_keys": object_keys}
            )

        # --- Pass 2: Abandoned article images (Tiptap drafts never published) ---
        # Orphaned when:
        #   - asset_type = 'article_image', is_committed = TRUE
        #   - No live (is_published=TRUE) article body contains the object_key
        #   - Upload is older than 24 hours (covers all legitimate multi-day drafts)
        abandoned_rows = db.execute(text("""
            SELECT mu.id, mu.object_key
            FROM   media_uploads mu
            LEFT JOIN articles a
                   ON a.content LIKE CONCAT('%', mu.object_key, '%')
                  AND a.is_published = TRUE
            WHERE  mu.asset_type = 'article_image'
              AND  mu.is_committed = TRUE
              AND  a.id IS NULL
              AND  mu.created_at < NOW() - INTERVAL 24 HOUR
            LIMIT  200
        """)).fetchall()

        if abandoned_rows:
            ids         = [r[0] for r in abandoned_rows]
            object_keys = [r[1] for r in abandoned_rows]

            r2.delete_objects(
                Bucket=settings.R2_BUCKET_NAME,
                Delete={"Objects": [{"Key": k} for k in object_keys], "Quiet": True}
            )
            db.execute(
                text("DELETE FROM media_uploads WHERE id IN :ids"),
                {"ids": tuple(ids)}
            )
            db.commit()
            logger.info(
                "[orphan_cleanup] Deleted %d abandoned article images", len(abandoned_rows)
            )

    except Exception as exc:
        db.rollback()
        logger.exception("[orphan_cleanup] Error during cleanup: %s", exc)
    finally:
        db.close()
```

> [!WARNING]
> The `LIKE CONCAT('%', mu.object_key, '%')` join will not use an index and becomes a full-table scan as the articles table grows. For Phase 1 (< 10k articles) this is acceptable. **Log to `TECH_DEBT.md`:** extract embedded image keys into a dedicated `article_images` join table populated at publish time, then replace the LIKE with a keyed join.

### D.4 — Tiptap Article Abandonment Edge Case

When a user opens a Tiptap session, uploads images (which get `is_committed = TRUE` immediately on client confirmation), then closes the browser without publishing, images persist in R2 until Pass 2 of the cron runs.

**Why the 24-hour grace period?** Tiptap sessions are not server-managed — the browser may go offline, the user may save a local draft, or the article may be in a legitimate multi-day drafting workflow. 24 hours covers all realistic editing sessions while still preventing indefinite ghost accumulation.

**Future improvement:** When article autosave is implemented, the draft's `last_modified` timestamp provides a much more precise abandonment signal.

### D.5 — Inverse: User-Initiated Deletion (`DELETE /api/v1/media/:object_key`)

```python
@router.delete("/{object_key}")
async def delete_media(
    object_key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Ownership check
    record = db.execute(text("""
        SELECT id, asset_type, entity_id FROM media_uploads
        WHERE object_key = :key AND uploaded_by = :uid
    """), {"key": object_key, "uid": current_user.id}).fetchone()

    if not record:
        raise HTTPException(status_code=404, detail="Media record not found or access denied")

    # 2. Null the FK column in the relevant entity table
    _null_entity_column(db, record.asset_type, record.entity_id)

    # 3. Delete from R2
    r2 = _get_r2_client()
    r2.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=object_key)

    # 4. Delete DB record (after confirmed R2 deletion)
    db.execute(text("DELETE FROM media_uploads WHERE id = :id"), {"id": record.id})
    db.commit()

    # 5. Activity log -- required by backend standards section 8
    log_activity(db, current_user.id, "media:delete", {"object_key": object_key})

    return {"status": "deleted"}


def _null_entity_column(db: Session, asset_type: str, entity_id: int) -> None:
    """Map asset_type to the correct table/column, then null it."""
    TARGET_MAP = {
        "avatar":       ("users",   "avatar_url"),
        "author_cover": ("authors", "cover_image_url"),
        "work_cover":   ("works",   "cover_image_url"),
    }
    if asset_type not in TARGET_MAP:
        return  # article_image: handled by removing URL from article content separately
    table, column = TARGET_MAP[asset_type]
    # f-string is safe: table/column sourced from a hardcoded map, never user input
    db.execute(text(f"UPDATE {table} SET {column} = NULL WHERE id = :id"), {"id": entity_id})
```

---

## E. CDN & Performance Optimization

### E.1 — R2 Public URL vs Custom Domain

| Configuration | URL Pattern | Use Case | Trade-off |
|---|---|---|---|
| R2 default public bucket URL | `https://<account_id>.r2.dev/<key>` | Dev / testing only | No custom Cache-Control; exposes account ID |
| Cloudflare custom domain | `https://images.awadhi.com/<key>` | **Production** | Full control over cache headers, WAF, Image Resizing |

**Recommended production setup:**

1. CNAME: `images.awadhi.com -> <bucket>.r2.dev` (Cloudflare DNS, orange-clouded).
2. Enable R2 Custom Domain in the Cloudflare dashboard.
3. All presigned URLs and confirmed `cdn_url` values in DB use `images.awadhi.com`.

This means a future bucket migration only requires updating the DNS CNAME — every URL already stored in the DB remains valid.

### E.2 — Cache-Control Per Asset Type

| Asset Type | Cache-Control Value | Rationale |
|---|---|---|
| `avatar` | `public, max-age=3600, stale-while-revalidate=300` | Avatars change occasionally; 1-hour TTL balances freshness and CDN offload |
| `author_cover` | `public, max-age=2592000, immutable` | 30 days. Covers are replaced (new UUID key), never mutated in place |
| `work_cover` | `public, max-age=2592000, immutable` | Same rationale as author_cover |
| `article_image` | `public, max-age=31536000, immutable` | 1 year + immutable. UUID keys, written once, bytes never change |

**Why `immutable` is safe for covers and article images:** Every upload generates a new UUID-based `object_key`. When a user "updates" their cover, the old key is deleted (§D.5) and a new key is written. The CDN URL in the DB is updated to the new key. No cache invalidation is ever needed because old URLs 404 on R2 (deleted) and new URLs have fresh keys.

**Cloudflare Worker — response header injection (serve-side worker):**

```javascript
const CACHE_HEADERS = {
  avatar:        'public, max-age=3600, stale-while-revalidate=300',
  author_cover:  'public, max-age=2592000, immutable',
  work_cover:    'public, max-age=2592000, immutable',
  article_image: 'public, max-age=31536000, immutable',
};

export default {
  async fetch(request, env) {
    const response = await env.R2_BUCKET.fetch(request);
    const url = new URL(request.url);
    const assetType = inferAssetType(url.pathname); // infer from path prefix

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', CACHE_HEADERS[assetType] ?? 'public, max-age=3600');
    headers.set('Vary', 'Accept');  // enables WebP/AVIF content negotiation

    return new Response(response.body, { ...response, headers });
  }
};
```

### E.3 — Cloudflare Image Resizing for Responsive Variants

Cloudflare Image Resizing (paid plan) allows on-the-fly variant generation without pre-generating thumbnails at upload time.

**URL pattern:** `https://images.awadhi.com/cdn-cgi/image/<options>/<object_key>`

```typescript
// lib/media/image-urls.ts
export function avatarUrl(objectKey: string, size: 40 | 80 | 160 = 80): string {
  return `https://images.awadhi.com/cdn-cgi/image/width=${size},height=${size},fit=cover,format=auto,quality=85/${objectKey}`;
}

export function coverUrl(objectKey: string, width: 400 | 800 | 1200 = 800): string {
  return `https://images.awadhi.com/cdn-cgi/image/width=${width},fit=contain,format=auto,quality=85/${objectKey}`;
}
```

`format=auto` serves WebP or AVIF to supporting browsers via `Accept` header negotiation, falling back to JPEG for Safari <14. This typically reduces image payload size by 25-40% vs JPEG alone.

### E.4 — Browser-Side Performance

```svelte
<!-- AvatarImage.svelte -->
<img
  src={avatarUrl(objectKey, 80)}
  srcset="{avatarUrl(objectKey, 80)} 1x, {avatarUrl(objectKey, 160)} 2x"
  width="80"
  height="80"
  loading="lazy"
  decoding="async"
  alt={altText}
/>
```

```svelte
<!-- CoverImage.svelte -- responsive with art direction -->
<picture>
  <source media="(max-width: 640px)" srcset={coverUrl(objectKey, 400)} type="image/webp" />
  <source
    media="(min-width: 641px)"
    srcset="{coverUrl(objectKey, 800)} 1x, {coverUrl(objectKey, 1200)} 1.5x"
    type="image/webp"
  />
  <img src={coverUrl(objectKey, 800)} loading="lazy" decoding="async" alt={altText} />
</picture>
```

| Attribute | Effect |
|---|---|
| `loading="lazy"` | Defers off-screen image fetches; native browser support since 2020 |
| `decoding="async"` | Decodes in parallel with layout — prevents main-thread jank |
| `srcset` | Lets browser pick the right resolution for the device's pixel density |
| `width` + `height` | Eliminates Cumulative Layout Shift (CLS) by reserving space before load |

---

## F. Edge Cases & Failure Modes

| Scenario | Impact | Mitigation |
|---|---|---|
| **R2 PUT succeeds but client never calls `/confirm`** | Object sits in R2 as uncommitted; never served | Hourly orphan cron deletes it after the 7-min grace period (§D.3) |
| **`/confirm` call times out (network drop)** | `is_committed` stays `FALSE`; object live in R2 but invisible to app | Client retries confirm with idempotency key; cron is the safety net |
| **KV write fails after R2 PUT succeeds** | Second PUT allowed (KV still says "pending") | Acceptable: R2 is key-addressed; second PUT overwrites with same or different bytes. Last-write-wins. R2 not corrupted. |
| **R2 DELETE in cron fails (R2 outage)** | Object persists in R2; DB record deleted (or vice versa) | DB record deletion only after confirmed R2 deletion. Cron retries on next hourly run. |
| **User deletes avatar, then immediately re-uploads** | Race: cron may target the new object | Cron targets by `uploaded_by + object_key`. New upload gets new UUID key — cron never targets it |
| **`image/gif` >5 MB animated GIF** | File passes MIME check but is slow/expensive to serve | Per-asset size cap at L2 and L3 rejects oversized GIFs. Consider blocking animated GIFs for `article_image` entirely. |
| **Cloudflare Image Resizing quota exhausted** | Resizing requests fail | Graceful fallback: `<img src>` points to original key (no `/cdn-cgi/image/` wrapper) |
| **User uploads image, session expires mid-flow** | Token issued, user logs out, presigned URL valid for remainder of 5-min TTL | URL is HMAC-bound to `user_id`. R2 accepts the PUT, but `/confirm` requires a valid session JWT -- unauthenticated confirm rejected |
| **Two simultaneous upload modals** | Two presigned URLs for different keys; both complete | Both are independent -- valid behavior. Rate limit (§C.1) applies to total hourly count |
| **Article image embedded in Tiptap, article never published** | Image persists past 24h check | Abandoned-draft cron (§D.4) catches this. If article IS published eventually, LEFT JOIN protects the image |
| **Admin bulk-updates 500 cover images at once** | 500 upload tokens in rapid succession | Admin limit (200/hour) accommodates this. Cloudflare 60/10min per-IP rule may block -- add admin IPs to Cloudflare allowlist |
| **UUID object key collision** | Second upload overwrites first | UUID4 collision probability ~1 in 5.3e36. Not a practical risk. ULIDs available as a more sortable alternative if needed. |
| **Cloudflare KV cold-start latency** | KV read adds ~10-30ms on cold edge PoP | Acceptable. Sub-millisecond on warm PoPs. One-time cost per upload, not per image serve. |

---

## Summary: Security Layer Map

```
USER BROWSER
|
|  L1: file.type + file.size check (UX feedback only -- not a security control)
|
v
FASTAPI /api/v1/media/upload-token
|
|  L2: Auth (JWT) -> RBAC (role_at_least CONTRIBUTOR)
|      -> MIME whitelist -> size cap per asset_type
|      -> Rate limit (check_and_increment, role-keyed)
|      -> HMAC-SHA256 token generation
|      -> KV "pending" registration
|
v  (presigned PUT URL returned to browser)
|
BROWSER ---- PUT ----> images.awadhi.com (Cloudflare edge)
                              |
                       L3 Cloudflare Worker:
                           -> KV one-time-use check (pending -> used)
                           -> Content-Length vs asset_type cap
                           -> Magic-byte MIME verification
                              |
                              v
                       CLOUDFLARE R2 (object stored)
|
v
FASTAPI /api/v1/media/confirm  (client calls after PUT succeeds)
|
|  L4 (async BackgroundTask):
|      -> SHA-256 hash stored for dedup/audit
|      -> CSAM scan (FUTURE -- log to TECH_DEBT.md)
|      -> is_committed = TRUE
|      -> cdn_url saved to entity table
|
v
Cloudflare D1 media_uploads.cdn_url --> article / profile reads through CDN
|
APScheduler (every hour, :00):
    -> Pass 1: DELETE uncommitted records past expires_at + R2 batch delete
    -> Pass 2: DELETE abandoned article images (>24h, no live article reference)
