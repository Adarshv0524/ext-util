# Section 2: Database Requirements & Schema Design
**Awadhi Literature Platform — Decoupled Image Upload Microservice**
*Architectural Audit Document · Data Architect Perspective*

---

## Preamble: Grounding in the Real Schema

The Awadhi platform currently runs a **29-table MySQL schema** (SQLAlchemy 2.0 ORM, Alembic-managed, collation `utf8mb4_unicode_ci`). The tables directly touched by image upload are:

| Table | Current image column(s) | Type in DB |
|---|---|---|
| `users` | `avatar_url` | `TEXT` (widened in `7de4e68c3755`) |
| `authors` | `portrait_url`, `audio_pronunciation_url` | `TEXT` |
| `works` | `cover_image_url`, `audio_recitation_url` | `TEXT` |
| `submissions` | *(none; rich Tiptap JSON via `type_specific_data`)* | — |
| `content_collections` | `cover_image_url` | `TEXT` |

> [!WARNING]
> Migration `7de4e68c3755` widened several URL columns from `VARCHAR(500)` to `TEXT` with the commit message **"Change URL fields to Text to support base64"**. This is the critical anti-pattern this section is designed to reverse architecturally. The R2 integration makes that rationale obsolete.

---

## A. Philosophy: What NOT to Store in MySQL

### A.1 — Never Store Binary Image Data

MySQL is an ACID-compliant relational store optimised for structured, indexed, row-level data. It is categorically the wrong tool for binary blobs.

| What to avoid | Why |
|---|---|
| `BLOB` / `LONGBLOB` columns containing raw image bytes | Inflates InnoDB tablespace. Each `SELECT *` on a wide table transfers megabytes of useless binary data to the application layer. Backup files balloon. Point-in-time recovery slows dramatically. |
| `TEXT` columns containing Base64-encoded images | Base64 adds ~33 % overhead over raw bytes. Stored in-row, it blows the `innodb_page_size` (16 KB default); MySQL must write the value to off-page overflow pages (via `DYNAMIC` row format), causing an extra page read per row. The previous migration `7de4e68c3755` introduced exactly this risk; it must not be used this way. |
| JSON fields containing image data URIs | Same as base64 — compounded by the JSON parsing overhead and the loss of MySQL's ability to use covering indexes on adjacent columns. |
| Externally-fetched image bytes cached in `TEXT` | Defeats CDN caching. Every page load becomes a DB round-trip. |

### A.2 — What MySQL SHOULD Store

MySQL's role in the image pipeline is limited to **metadata pointers**:

```
MySQL                  Cloudflare R2
──────────────────     ────────────────────────────────────────────
VARCHAR(500) URL  ───▶  https://pub.awadhi.app/r2/users/42/avatar.webp
                                         ▲
                                   R2 Public Bucket
                                   (CDN-fronted, immutable keys)
```

The string in MySQL is:
- **Immutable once written** (R2 object keys never change after commit)
- **Fast to `SELECT`** (fits inside the B-tree leaf page, zero overflow)
- **Indexable** (for deduplication or orphan queries if needed)

### A.3 — The Text → VARCHAR Reversal

Now that images flow through R2, all URL columns should be **reverted to `VARCHAR(500)`**. A Cloudflare R2 public URL with a custom domain has the form:

```
https://pub.awadhi.app/authors/tulsidas/cover.webp
```

The maximum realistic length is ≈ 300 characters. `VARCHAR(500)` provides headroom without the page-overflow risk of `TEXT`. The Alembic migration in §E handles this reversion.

---

## B. Minimal Schema Additions to Existing Tables

All additions follow a single principle: **one column per semantic image slot, `VARCHAR(500)`, nullable, no default**. Nullable means "not yet uploaded" — the application layer, not the DB, enforces completeness.

### B.1 — `users` Table

**Current state:** `avatar_url TEXT` already exists (baseline migration + `7de4e68c3755`).

**Required changes:**

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `avatar_url` | `VARCHAR(500)` | NULL | Profile picture (square crop, ≤ 512 × 512 px recommended) |
| `cover_url` | `VARCHAR(500)` | NULL | Profile banner / hero image (wide-format, new column) |

> [!NOTE]
> `avatar_url` already exists as `TEXT`. The migration **alters** it back to `VARCHAR(500)` (safe downsize because R2 URLs fit comfortably) and **adds** `cover_url` as a net-new nullable column.

**Rationale for `cover_url`:** Mirrors the UX pattern of Twitter/GitHub profiles — a separate wide-format banner distinct from the avatar. Keeping them as two separate atomic columns (not a JSON object) allows the API to update each independently without fetching and merging the other.

---

### B.2 — `authors` Table

**Current state:** `portrait_url TEXT`, `audio_pronunciation_url TEXT`.

**Required changes:**

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `portrait_url` | `VARCHAR(500)` | NULL | Primary author portrait (rename candidate: `avatar_url` for consistency — kept as-is to avoid breaking existing queries) |
| `cover_url` | `VARCHAR(500)` | NULL | Full-width author header banner (new) |
| `thumbnail_url` | `VARCHAR(500)` | NULL | Small listing card image (new; 300 × 300 px, used in search results, author carousels) |

**Why separate `cover_url` and `thumbnail_url`?**

Authors appear in two distinct rendering contexts:
1. **Dedicated author page** — needs a wide `cover_url` hero image.
2. **Search results / carousels** — needs a compact square `thumbnail_url` that is aggressively cached and served from CDN edge.

Storing separate URLs allows the frontend to request the semantically correct asset without client-side resizing logic. R2 can serve both from the same bucket with different keys.

---

### B.3 — `works` Table

**Current state:** `cover_image_url TEXT`.

**Required changes:**

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `cover_url` | `VARCHAR(500)` | NULL | Primary work cover image — replaces `cover_image_url` |

> [!IMPORTANT]
> The column is **renamed** from `cover_image_url` → `cover_url` for API consistency across all entities (users, authors, works all expose `cover_url`). This is a **breaking change** in the ORM model and any raw SQL that references `cover_image_url` by name. All call-sites in `api/` routers must be audited. Alembic handles the `op.alter_column` rename.

---

### B.4 — `submissions` Table — **No New Column Required**

The `submissions` table uses a **polymorphic content architecture**:

```python
class Submission(Base):
    type_specific_data = Column(JSON)   # via SubmissionMetadata.type_specific_data
    # ...

class SubmissionMetadata(Base):
    type_specific_data = Column(JSON)   # Form-specific fields per literary type
```

When a contributor writes a `gadya` (prose), `lokgeet`, or any rich-text submission, the body is authored in **Tiptap** (a ProseMirror-based editor). Tiptap serialises its document as a JSON tree:

```json
{
  "type": "doc",
  "content": [
    { "type": "paragraph", "content": [
        { "type": "text", "text": "कबीर के दोहे..." }
    ]},
    {
      "type": "image",
      "attrs": {
        "src": "https://pub.awadhi.app/submissions/img/abc123.webp",
        "alt": "manuscript scan"
      }
    }
  ]
}
```

Image URLs inserted by the editor live **inside this JSON blob** under `attrs.src`. They are:
- **Already stored** — no schema change is needed.
- **Already tracked** — the `media_assets` table (§C) records the R2 object key; `associated_entity_type = 'submission'` links it back.
- **Orphan-safe** — when a submission is deleted (`is_deleted = TRUE`), a background job queries `media_assets` for all records with `associated_entity_type = 'submission'` and `associated_entity_id = <id>` to purge from R2.

Adding a dedicated column to `submissions` would create a false assumption that a submission has exactly one image. Tiptap documents can embed zero to many images.

---

## C. The `media_assets` Tracking Table

### C.1 — Purpose and Design Philosophy

The `media_assets` table is the **control plane** for R2 objects. Its sole responsibility is orphan lifecycle management. It does NOT serve as an image CDN catalogue or a metadata store — it is a transactional ledger answering the question:

> *"Which R2 objects were uploaded but never attached to a real entity, and are therefore safe to delete?"*

### C.2 — Column-by-Column Specification

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, AUTO_INCREMENT | BIGINT for future-proofing high upload volumes |
| `uploader_user_id` | `INT` | FK → `users.id`, NOT NULL | Always known; presigned URL generation is auth-gated |
| `r2_object_key` | `VARCHAR(500)` | NOT NULL, UNIQUE | The R2 key e.g. `users/42/avatar/2026-07-26T09-18Z.webp` |
| `public_url` | `VARCHAR(500)` | NOT NULL | Full CDN URL stored for convenience; derivable from key but cached here |
| `asset_type` | `ENUM(...)` | NOT NULL | Semantic category — drives cleanup policy |
| `associated_entity_type` | `VARCHAR(50)` | NULL | `'user'`, `'author'`, `'work'`, `'submission'`, `'collection'` |
| `associated_entity_id` | `INT` | NULL | PK of the associated row in the target table |
| `is_committed` | `BOOLEAN` | NOT NULL, DEFAULT FALSE | The critical lifecycle flag |
| `uploaded_at` | `TIMESTAMP` | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When R2 upload completed |
| `committed_at` | `TIMESTAMP` | NULL | When `is_committed` flipped to TRUE |
| `expires_at` | `TIMESTAMP` | NULL | Deadline for orphan cleanup; NULL = permanent |

**`asset_type` ENUM values:**

```sql
ENUM(
  'user_avatar',
  'user_cover',
  'author_portrait',
  'author_cover',
  'author_thumbnail',
  'work_cover',
  'submission_inline',   -- image embedded in a Tiptap document
  'collection_cover'
)
```

### C.3 — The `is_committed` Lifecycle

```
                ┌─────────────────────────────────────────────────────┐
                │                   UPLOAD FLOW                      │
                └─────────────────────────────────────────────────────┘

  1. Client requests presigned POST URL from Image Microservice
  2. Microservice creates a media_assets row:
        is_committed = FALSE
        uploaded_at  = NOW()
        expires_at   = NOW() + INTERVAL 1 HOUR  ← orphan TTL
  3. Client uploads directly to R2 → success
  4. Client sends public_url to Main App (PATCH /users/me, POST /works, etc.)
  5. Main App:
        a. Writes the URL into the entity column (users.avatar_url, etc.)
        b. UPDATEs media_assets SET
               is_committed       = TRUE,
               committed_at       = NOW(),
               associated_entity_type = 'user',
               associated_entity_id   = 42,
               expires_at         = NULL    ← permanent; no longer orphanable
        WHERE r2_object_key = '<key>'
```

**`is_committed` flips to TRUE** at the exact moment the URL is persisted to the entity table in the same database transaction. If step 5 fails (e.g. the entity `PATCH` rolls back), `is_committed` stays `FALSE` and `expires_at` governs cleanup.

**Orphan cleanup job** (runs hourly via Celery beat or a cron script):

```python
# Pseudocode
stale = db.query(MediaAsset).filter(
    MediaAsset.is_committed == False,
    MediaAsset.expires_at < datetime.utcnow()
).all()
for asset in stale:
    r2_client.delete_object(Bucket=R2_BUCKET, Key=asset.r2_object_key)
    db.delete(asset)
db.commit()
```

### C.4 — Full SQL DDL

```sql
-- ============================================================
--  media_assets  ·  R2 object lifecycle tracking
--  Collation: utf8mb4_unicode_ci (matches all platform tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS `media_assets` (
    `id`                      BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
    `uploader_user_id`        INT               NOT NULL,
    `r2_object_key`           VARCHAR(500)      NOT NULL  COMMENT 'R2 bucket object key, e.g. users/42/avatar/ts.webp',
    `public_url`              VARCHAR(500)      NOT NULL  COMMENT 'Full CDN-fronted public URL',
    `asset_type`              ENUM(
                                  'user_avatar',
                                  'user_cover',
                                  'author_portrait',
                                  'author_cover',
                                  'author_thumbnail',
                                  'work_cover',
                                  'submission_inline',
                                  'collection_cover'
                              )                 NOT NULL,
    `associated_entity_type`  VARCHAR(50)       NULL      DEFAULT NULL  COMMENT 'Target table logical name',
    `associated_entity_id`    INT               NULL      DEFAULT NULL  COMMENT 'PK in the target entity table',
    `is_committed`            TINYINT(1)        NOT NULL  DEFAULT 0     COMMENT '1 = URL saved to entity; 0 = pending/orphan',
    `uploaded_at`             TIMESTAMP         NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    `committed_at`            TIMESTAMP         NULL      DEFAULT NULL,
    `expires_at`              TIMESTAMP         NULL      DEFAULT NULL   COMMENT 'NULL = permanent. Non-null = orphan deadline.',

    PRIMARY KEY (`id`),

    UNIQUE KEY  `uq_media_assets_r2_key`        (`r2_object_key`),

    -- Orphan sweep: find uncommitted assets past their TTL
    INDEX       `idx_media_orphan_sweep`        (`is_committed`, `expires_at`),

    -- Per-user asset listing (profile management UI)
    INDEX       `idx_media_uploader`            (`uploader_user_id`, `asset_type`),

    -- Entity-based lookup (used when an entity is deleted)
    INDEX       `idx_media_entity`              (`associated_entity_type`, `associated_entity_id`),

    CONSTRAINT  `fk_media_assets_user`
        FOREIGN KEY (`uploader_user_id`)
        REFERENCES  `users` (`id`)
        ON DELETE   RESTRICT     -- never silently drop an asset record when a user is deleted
        ON UPDATE   CASCADE,

    -- Soft-enforce: committed assets must have entity info
    -- (Hard enforcement via app layer; MySQL CHECK constraints added for documentation)
    CONSTRAINT  `chk_committed_has_entity`
        CHECK (
            `is_committed` = 0
            OR (
                `associated_entity_type` IS NOT NULL
                AND `associated_entity_id` IS NOT NULL
            )
        )

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='R2 object lifecycle tracker. Drives orphan-cleanup job.';
```

> [!NOTE]
> `ON DELETE RESTRICT` on the FK is intentional. If a user account is hard-deleted, the service layer must first purge their R2 objects and delete `media_assets` rows before the `users` row deletion proceeds. This prevents silent data leaks to R2.

### C.5 — SQLAlchemy 2.0 Model

```python
# app/db/models.py  ── append after ContentVersion

import enum
from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum as SAEnum,
    ForeignKey, Index, Integer, String, text, CheckConstraint,
)
from sqlalchemy.orm import relationship


class AssetType(str, enum.Enum):
    """
    Semantic category of every R2-hosted asset.
    Must stay in sync with the DDL ENUM above.
    """
    USER_AVATAR        = "user_avatar"
    USER_COVER         = "user_cover"
    AUTHOR_PORTRAIT    = "author_portrait"
    AUTHOR_COVER       = "author_cover"
    AUTHOR_THUMBNAIL   = "author_thumbnail"
    WORK_COVER         = "work_cover"
    SUBMISSION_INLINE  = "submission_inline"
    COLLECTION_COVER   = "collection_cover"


class MediaAsset(Base):
    """
    Lifecycle tracker for every image uploaded to Cloudflare R2.

    An asset is 'uncommitted' (is_committed=False) from the moment
    R2 acknowledges the upload until the Main App persists the URL
    to the target entity column.  Uncommitted assets past expires_at
    are swept by the orphan-cleanup job.
    """
    __tablename__ = "media_assets"

    id = Column(
        BigInteger().with_variant(BigInteger, "mysql"),
        primary_key=True,
        autoincrement=True,
    )

    # ── Ownership ──────────────────────────────────────────────────────────
    uploader_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )

    # ── R2 identity ────────────────────────────────────────────────────────
    r2_object_key = Column(String(500), nullable=False, unique=True)
    public_url    = Column(String(500), nullable=False)

    # ── Classification ─────────────────────────────────────────────────────
    asset_type = Column(
        SAEnum(AssetType, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )

    # ── Polymorphic entity link (NULL until committed) ──────────────────────
    associated_entity_type = Column(String(50),  nullable=True, default=None)
    associated_entity_id   = Column(Integer,      nullable=True, default=None)

    # ── Lifecycle flags ────────────────────────────────────────────────────
    is_committed = Column(Boolean, nullable=False, default=False)
    uploaded_at  = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    committed_at = Column(DateTime(timezone=True), nullable=True, default=None)
    expires_at   = Column(DateTime(timezone=True), nullable=True, default=None)

    # ── Relationships ──────────────────────────────────────────────────────
    uploader = relationship("User", foreign_keys=[uploader_user_id])

    # ── Table args (indexes + CHECK constraint) ────────────────────────────
    __table_args__ = (
        # Orphan sweep: WHERE is_committed = 0 AND expires_at < NOW()
        Index("idx_media_orphan_sweep", "is_committed", "expires_at"),

        # Per-user asset gallery queries
        Index("idx_media_uploader", "uploader_user_id", "asset_type"),

        # Cascade-delete queries when an entity is removed
        Index("idx_media_entity", "associated_entity_type", "associated_entity_id"),

        # DB-level guard: committed assets must carry entity info
        CheckConstraint(
            "(is_committed = 0) OR "
            "(associated_entity_type IS NOT NULL AND associated_entity_id IS NOT NULL)",
            name="chk_committed_has_entity",
        ),
    )

    def commit(self, entity_type: str, entity_id: int) -> None:
        """
        Convenience method called inside the same DB transaction
        that writes the URL to the entity table.

        Usage (inside a router or service):
            asset = db.get(MediaAsset, asset_id)
            asset.commit("user", current_user.id)
            current_user.avatar_url = asset.public_url
            db.commit()
        """
        from datetime import datetime, timezone
        self.is_committed            = True
        self.committed_at            = datetime.now(timezone.utc)
        self.associated_entity_type  = entity_type
        self.associated_entity_id    = entity_id
        self.expires_at              = None   # permanent; remove orphan TTL
```

---

## D. Index Strategy

### D.1 — Indexes on `media_assets` (New Table)

| Index name | Columns | Type | Justification |
|---|---|---|---|
| `PRIMARY` | `id` | PK (clustered) | Row retrieval by surrogate key; BIGINT for future scale |
| `uq_media_assets_r2_key` | `r2_object_key` | UNIQUE | Prevents duplicate registration of the same R2 key; used by the commit flow to look up the row by key after client confirmation |
| `idx_media_orphan_sweep` | `(is_committed, expires_at)` | Composite | Core query for the hourly cleanup job: `WHERE is_committed = 0 AND expires_at < NOW()`. Leading column is a low-cardinality boolean — MySQL will use it as a range filter into the timestamp column |
| `idx_media_uploader` | `(uploader_user_id, asset_type)` | Composite | Supports "show all images uploaded by user X" and "show all avatars uploaded by user X" — profile management UI |
| `idx_media_entity` | `(associated_entity_type, associated_entity_id)` | Composite | Supports cascade-on-entity-delete queries: "find all R2 objects associated with author id=7" |

### D.2 — Indexes on Modified Existing Tables

These tables gain new `VARCHAR(500)` columns. Because image URLs are **never used in WHERE clauses** (we always look up by entity PK, not by URL), **no additional indexes** are needed on the new URL columns.

| Table | New column | Index needed? | Reason |
|---|---|---|---|
| `users` | `cover_url` | ❌ No | Fetched via `WHERE id = ?`, URL is payload not predicate |
| `authors` | `cover_url`, `thumbnail_url` | ❌ No | Same — author looked up by `id` or `slug` (already indexed) |
| `works` | `cover_url` (rename of `cover_image_url`) | ❌ No | Looked up by `id` or `author_id + slug` (already indexed) |

### D.3 — Orphan Sweep Query — Execution Plan Note

```sql
EXPLAIN SELECT id, r2_object_key
FROM media_assets
WHERE is_committed = 0
  AND expires_at < NOW();
```

Expected plan: **range scan** on `idx_media_orphan_sweep`. The optimizer will use `is_committed = 0` (const) as the first key part, then scan timestamps less than `NOW()`. Covering index not possible (need `r2_object_key` from the table row), but the index access is sufficient given the expected low cardinality of uncommitted rows.

---

## E. Migration Impact

### E.1 — Alembic Migration Scope

**Revision ID (to be assigned):** `a7f3b9d2c1e4_add_media_assets_and_r2_url_schema`
**Revises:** `7de4e68c3755` (the current HEAD — URL fields → TEXT migration)

**Tables touched:**

| Table | Operation | Risk |
|---|---|---|
| `users` | `ALTER COLUMN avatar_url TEXT → VARCHAR(500)` + `ADD COLUMN cover_url` | 🟡 Low |
| `authors` | `ALTER COLUMN portrait_url TEXT → VARCHAR(500)` + `ADD COLUMN cover_url, thumbnail_url` | 🟡 Low |
| `works` | `ALTER COLUMN cover_image_url TEXT → VARCHAR(500)` + rename → `cover_url` | 🔴 **Medium** — rename breaks ORM aliases |
| `submissions` | None | ✅ Zero |
| `media_assets` | `CREATE TABLE` | ✅ Zero (additive) |

### E.2 — Full Migration File

```python
"""Add media_assets table and revert URL columns to VARCHAR(500)

Revision ID: a7f3b9d2c1e4
Revises: 7de4e68c3755
Create Date: 2026-07-26

Scope:
  - Create media_assets tracking table
  - users: revert avatar_url TEXT → VARCHAR(500); add cover_url
  - authors: revert portrait_url TEXT → VARCHAR(500); add cover_url, thumbnail_url
  - works: revert cover_image_url TEXT → VARCHAR(500); rename → cover_url
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = 'a7f3b9d2c1e4'
down_revision: Union[str, None] = '7de4e68c3755'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Create media_assets ──────────────────────────────────────────
    op.create_table(
        "media_assets",
        sa.Column("id",                     sa.BigInteger(),  autoincrement=True, nullable=False),
        sa.Column("uploader_user_id",       sa.Integer(),     nullable=False),
        sa.Column("r2_object_key",          sa.String(500),   nullable=False),
        sa.Column("public_url",             sa.String(500),   nullable=False),
        sa.Column(
            "asset_type",
            sa.Enum(
                "user_avatar", "user_cover", "author_portrait",
                "author_cover", "author_thumbnail", "work_cover",
                "submission_inline", "collection_cover",
                name="assettype",
            ),
            nullable=False,
        ),
        sa.Column("associated_entity_type", sa.String(50),    nullable=True),
        sa.Column("associated_entity_id",   sa.Integer(),     nullable=True),
        sa.Column("is_committed",           sa.Boolean(),     nullable=False, server_default=sa.text("0")),
        sa.Column("uploaded_at",            sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("committed_at",           sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at",             sa.DateTime(timezone=True), nullable=True),

        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("r2_object_key", name="uq_media_assets_r2_key"),
        sa.ForeignKeyConstraint(
            ["uploader_user_id"], ["users.id"],
            name="fk_media_assets_user",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        sa.CheckConstraint(
            "(is_committed = 0) OR "
            "(associated_entity_type IS NOT NULL AND associated_entity_id IS NOT NULL)",
            name="chk_committed_has_entity",
        ),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
        comment="R2 object lifecycle tracker. Drives orphan-cleanup job.",
    )
    op.create_index("idx_media_orphan_sweep", "media_assets", ["is_committed", "expires_at"])
    op.create_index("idx_media_uploader",     "media_assets", ["uploader_user_id", "asset_type"])
    op.create_index("idx_media_entity",       "media_assets", ["associated_entity_type", "associated_entity_id"])

    # ── 2. users ────────────────────────────────────────────────────────
    # Revert avatar_url: TEXT → VARCHAR(500)  (R2 URLs are bounded strings)
    op.alter_column(
        "users", "avatar_url",
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=True,
    )
    # Add cover_url (profile banner)
    op.add_column("users",
        sa.Column("cover_url", sa.String(500), nullable=True, comment="Profile banner / hero image URL (R2)")
    )

    # ── 3. authors ──────────────────────────────────────────────────────
    # Revert portrait_url: TEXT → VARCHAR(500)
    op.alter_column(
        "authors", "portrait_url",
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=True,
    )
    # Add cover_url and thumbnail_url
    op.add_column("authors",
        sa.Column("cover_url",      sa.String(500), nullable=True, comment="Author page header banner URL (R2)")
    )
    op.add_column("authors",
        sa.Column("thumbnail_url",  sa.String(500), nullable=True, comment="Small card/listing thumbnail URL (R2)")
    )

    # ── 4. works ────────────────────────────────────────────────────────
    # Rename + revert: cover_image_url TEXT → cover_url VARCHAR(500)
    # MySQL does not support RENAME COLUMN before 8.0; use batch_alter for portability.
    with op.batch_alter_table("works") as batch_op:
        batch_op.alter_column(
            "cover_image_url",
            new_column_name="cover_url",
            existing_type=sa.Text(),
            type_=sa.String(500),
            existing_nullable=True,
        )


def downgrade() -> None:
    # ── 4. works ────────────────────────────────────────────────────────
    with op.batch_alter_table("works") as batch_op:
        batch_op.alter_column(
            "cover_url",
            new_column_name="cover_image_url",
            existing_type=sa.String(500),
            type_=sa.Text(),
            existing_nullable=True,
        )

    # ── 3. authors ──────────────────────────────────────────────────────
    op.drop_column("authors", "thumbnail_url")
    op.drop_column("authors", "cover_url")
    op.alter_column(
        "authors", "portrait_url",
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=True,
    )

    # ── 2. users ────────────────────────────────────────────────────────
    op.drop_column("users", "cover_url")
    op.alter_column(
        "users", "avatar_url",
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=True,
    )

    # ── 1. media_assets ─────────────────────────────────────────────────
    op.drop_index("idx_media_entity",       table_name="media_assets")
    op.drop_index("idx_media_uploader",     table_name="media_assets")
    op.drop_index("idx_media_orphan_sweep", table_name="media_assets")
    op.drop_table("media_assets")
    # Drop the ENUM type (MySQL auto-drops with table; explicit for Postgres compat)
    sa.Enum(name="assettype").drop(op.get_bind(), checkfirst=True)
```

### E.3 — Risk Assessment

| Change | Risk Level | Mitigation |
|---|---|---|
| `CREATE TABLE media_assets` | ✅ **Zero** | Purely additive. No existing query breaks. |
| `ADD COLUMN cover_url` (users, authors) | ✅ **Zero** | Nullable column add is an online metadata-only DDL in MySQL 8.0+ InnoDB (no table copy). |
| `ADD COLUMN thumbnail_url` (authors) | ✅ **Zero** | Same as above. |
| `ALTER COLUMN TEXT → VARCHAR(500)` (users, authors, works) | 🟡 **Low** | InnoDB may require a table rebuild if the column has overflow pages. Test on a data snapshot first. Existing data that fits in 500 chars (all valid R2 URLs) is unaffected. Any pre-existing base64 blob in `avatar_url` would be **truncated** — audit for these rows before running. |
| `RENAME cover_image_url → cover_url` (works) | 🔴 **Medium** | Any raw SQL string, Pydantic schema field, Alembic `existing_type` mismatch, or frontend key referencing `cover_image_url` will break silently. A grep across the codebase is mandatory before deployment. |

### E.4 — Reversibility

All changes are fully reversible via `alembic downgrade a7f3b9d2c1e4`:
- `DROP TABLE media_assets` — no data loss concern (new table, only exists if migration ran successfully).
- `DROP COLUMN` for the new nullable columns — safe; no existing data depends on them.
- `ALTER COLUMN VARCHAR(500) → TEXT` — widening, always safe.
- `RENAME cover_url → cover_image_url` — reverses the rename.

### E.5 — Pre-Migration Checklist

```bash
# 1. Verify no TEXT column contains a value > 500 chars
#    (would be truncated on ALTER)
SELECT id, LENGTH(avatar_url)  FROM users   WHERE LENGTH(avatar_url)  > 500;
SELECT id, LENGTH(portrait_url) FROM authors WHERE LENGTH(portrait_url) > 500;
SELECT id, LENGTH(cover_image_url) FROM works WHERE LENGTH(cover_image_url) > 500;

# 2. Grep all Python files for the old column name
grep -rn "cover_image_url" backend/app/

# 3. Grep Pydantic schemas
grep -rn "cover_image_url" backend/app/schemas/

# 4. Grep frontend TypeScript interfaces
grep -rn "cover_image_url" frontend/src/

# 5. Run migration on a staging DB clone first
alembic upgrade a7f3b9d2c1e4  # on staging

# 6. Run full pytest suite against staging
pytest backend/tests/ -x -q
```

---

## Summary Table

| Item | Decision |
|---|---|
| Binary/Base64 in MySQL | ❌ Never. R2 handles bytes; MySQL stores URL strings only. |
| URL column type | `VARCHAR(500)` — bounded, in-page, indexable. Not `TEXT`. |
| `users.cover_url` | ✅ New nullable column. |
| `authors.cover_url` + `thumbnail_url` | ✅ Two new nullable columns for distinct rendering contexts. |
| `works.cover_url` | ✅ Rename from `cover_image_url` for API consistency. |
| `submissions` changes | ❌ None — Tiptap JSON already carries inline image URLs. |
| `media_assets` table | ✅ New control-plane table. BIGINT PK, UNIQUE on R2 key, CHECK constraint enforcing committed state. |
| `is_committed` flip trigger | Inside the same DB transaction that writes the URL to the entity column. |
| Orphan cleanup | Cron/Celery job: `WHERE is_committed = 0 AND expires_at < NOW()`. |
| Migration risk | `media_assets` CREATE = zero risk. Column renames on `works` = medium risk (audit call-sites). |
| Reversibility | Fully reversible via `alembic downgrade`. |
