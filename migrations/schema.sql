DROP TABLE IF EXISTS media_assets;

CREATE TABLE media_assets (
    id TEXT PRIMARY KEY,
    uploader_user_id INTEGER NOT NULL,
    r2_object_key TEXT NOT NULL,
    public_url TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    associated_entity_type TEXT,
    associated_entity_id INTEGER,
    is_committed INTEGER DEFAULT 0,
    uploaded_at TEXT NOT NULL,
    committed_at TEXT,
    expires_at TEXT
);

CREATE INDEX idx_media_assets_r2_object_key ON media_assets (r2_object_key);
CREATE INDEX idx_media_assets_uploader ON media_assets (uploader_user_id);
CREATE INDEX idx_media_assets_uncommitted ON media_assets (is_committed) WHERE is_committed = 0;
