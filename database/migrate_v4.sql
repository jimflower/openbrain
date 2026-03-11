-- Open Brain Migration v4: Auto-expiry of time-sensitive thoughts
-- Run after migrate_v3.sql
-- Adds expires_at column and updates all search functions to exclude expired thoughts

-- Add expires_at column
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- Drop existing functions and view so we can recreate with updated return types
DROP FUNCTION IF EXISTS match_thoughts(vector, double precision, integer, jsonb);
DROP FUNCTION IF EXISTS match_thoughts_hybrid(vector, text, double precision, integer, jsonb);
DROP FUNCTION IF EXISTS match_thoughts_keyword(text, integer, jsonb);
DROP VIEW IF EXISTS brain_stats;

-- Index for efficient expiry filtering
CREATE INDEX IF NOT EXISTS thoughts_expires_at_idx ON thoughts (expires_at) WHERE expires_at IS NOT NULL;

-- Update vector-only search to exclude expired thoughts
CREATE OR REPLACE FUNCTION match_thoughts(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count     INT   DEFAULT 10,
    filter          JSONB DEFAULT '{}'
)
RETURNS TABLE (
    id            BIGINT,
    content       TEXT,
    metadata      JSONB,
    created_at    TIMESTAMPTZ,
    event_date    TIMESTAMPTZ,
    superseded_by BIGINT,
    expires_at    TIMESTAMPTZ,
    similarity    FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.content, t.metadata, t.created_at, t.event_date, t.superseded_by, t.expires_at,
           1 - (t.embedding <=> query_embedding) AS similarity
    FROM thoughts t
    WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
      AND t.superseded_by IS NULL
      AND (t.expires_at IS NULL OR t.expires_at > NOW())
      AND (filter = '{}' OR t.metadata @> filter)
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Update hybrid search to exclude expired thoughts
CREATE OR REPLACE FUNCTION match_thoughts_hybrid(
    query_embedding vector(768),
    query_text      TEXT,
    match_threshold FLOAT DEFAULT 0.2,
    match_count     INT   DEFAULT 10,
    filter          JSONB DEFAULT '{}'
)
RETURNS TABLE (
    id            BIGINT,
    content       TEXT,
    metadata      JSONB,
    created_at    TIMESTAMPTZ,
    event_date    TIMESTAMPTZ,
    superseded_by BIGINT,
    expires_at    TIMESTAMPTZ,
    similarity    FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.content, t.metadata, t.created_at, t.event_date, t.superseded_by, t.expires_at,
           (0.7 * (1 - (t.embedding <=> query_embedding)) +
            0.3 * LEAST(ts_rank_cd(t.search_vector, plainto_tsquery('english', query_text)), 1.0)) AS similarity
    FROM thoughts t
    WHERE (
        (1 - (t.embedding <=> query_embedding)) > match_threshold
        OR t.search_vector @@ plainto_tsquery('english', query_text)
    )
    AND t.superseded_by IS NULL
    AND (t.expires_at IS NULL OR t.expires_at > NOW())
    AND (filter = '{}' OR t.metadata @> filter)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Update keyword search to exclude expired thoughts
CREATE OR REPLACE FUNCTION match_thoughts_keyword(
    query_text   TEXT,
    match_count  INT  DEFAULT 10,
    filter       JSONB DEFAULT '{}'
)
RETURNS TABLE (
    id            BIGINT,
    content       TEXT,
    metadata      JSONB,
    created_at    TIMESTAMPTZ,
    event_date    TIMESTAMPTZ,
    superseded_by BIGINT,
    expires_at    TIMESTAMPTZ,
    similarity    FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.content, t.metadata, t.created_at, t.event_date, t.superseded_by, t.expires_at,
           LEAST(ts_rank_cd(t.search_vector, plainto_tsquery('english', query_text)), 1.0) AS similarity
    FROM thoughts t
    WHERE t.search_vector @@ plainto_tsquery('english', query_text)
      AND t.superseded_by IS NULL
      AND (t.expires_at IS NULL OR t.expires_at > NOW())
      AND (filter = '{}' OR t.metadata @> filter)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Update stats view to include expiry counts
CREATE OR REPLACE VIEW brain_stats AS
SELECT
    COUNT(*)                                                                          AS total_thoughts,
    COUNT(*) FILTER (WHERE superseded_by IS NULL
                      AND (expires_at IS NULL OR expires_at > NOW()))                AS active_thoughts,
    COUNT(*) FILTER (WHERE superseded_by IS NOT NULL)                                AS superseded_thoughts,
    COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= NOW())           AS expired_thoughts,
    COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at > NOW()
                      AND superseded_by IS NULL)                                     AS expiring_thoughts,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'
                       AND superseded_by IS NULL
                       AND (expires_at IS NULL OR expires_at > NOW()))               AS thoughts_last_7_days,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'
                       AND superseded_by IS NULL
                       AND (expires_at IS NULL OR expires_at > NOW()))               AS thoughts_last_30_days,
    MIN(created_at)                                                                   AS oldest_thought,
    MAX(created_at)                                                                   AS newest_thought
FROM thoughts;
