-- Open Brain Schema v2
-- PostgreSQL 15+ with pgvector
-- Features: hybrid search, deduplication, contradiction detection, event_date

CREATE EXTENSION IF NOT EXISTS vector;

-- Main thoughts table
CREATE TABLE IF NOT EXISTS thoughts (
    id            BIGSERIAL PRIMARY KEY,
    content       TEXT NOT NULL,
    embedding     vector(768),
    metadata      JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_date    TIMESTAMPTZ,                           -- when the described event happened
    superseded_by BIGINT REFERENCES thoughts(id),       -- NULL = active, set = replaced by newer thought
    search_vector TSVECTOR                               -- full-text search
);

-- Indexes
CREATE INDEX IF NOT EXISTS thoughts_metadata_idx      ON thoughts USING GIN (metadata);
CREATE INDEX IF NOT EXISTS thoughts_created_at_idx    ON thoughts (created_at DESC);
CREATE INDEX IF NOT EXISTS thoughts_search_vector_idx ON thoughts USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS thoughts_event_date_idx    ON thoughts (event_date DESC) WHERE event_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS thoughts_superseded_idx    ON thoughts (superseded_by) WHERE superseded_by IS NOT NULL;

-- Auto-update full-text search vector
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thoughts_search_vector_trigger ON thoughts;
CREATE TRIGGER thoughts_search_vector_trigger
    BEFORE INSERT OR UPDATE OF content ON thoughts
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Vector-only search (excludes superseded)
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
    similarity    FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.content, t.metadata, t.created_at, t.event_date, t.superseded_by,
           1 - (t.embedding <=> query_embedding) AS similarity
    FROM thoughts t
    WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
      AND t.superseded_by IS NULL
      AND (filter = '{}' OR t.metadata @> filter)
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Hybrid search: 70% vector + 30% full-text (excludes superseded)
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
    similarity    FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.content, t.metadata, t.created_at, t.event_date, t.superseded_by,
           (0.7 * (1 - (t.embedding <=> query_embedding)) +
            0.3 * LEAST(ts_rank_cd(t.search_vector, plainto_tsquery('english', query_text)), 1.0)) AS similarity
    FROM thoughts t
    WHERE (
        (1 - (t.embedding <=> query_embedding)) > match_threshold
        OR t.search_vector @@ plainto_tsquery('english', query_text)
    )
    AND t.superseded_by IS NULL
    AND (filter = '{}' OR t.metadata @> filter)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Keyword-only full-text search (excludes superseded)
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
    similarity    FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.content, t.metadata, t.created_at, t.event_date, t.superseded_by,
           LEAST(ts_rank_cd(t.search_vector, plainto_tsquery('english', query_text)), 1.0) AS similarity
    FROM thoughts t
    WHERE t.search_vector @@ plainto_tsquery('english', query_text)
      AND t.superseded_by IS NULL
      AND (filter = '{}' OR t.metadata @> filter)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Stats view
CREATE OR REPLACE VIEW brain_stats AS
SELECT
    COUNT(*)                                                          AS total_thoughts,
    COUNT(*) FILTER (WHERE superseded_by IS NULL)                    AS active_thoughts,
    COUNT(*) FILTER (WHERE superseded_by IS NOT NULL)                AS superseded_thoughts,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'
                       AND superseded_by IS NULL)                    AS thoughts_last_7_days,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'
                       AND superseded_by IS NULL)                    AS thoughts_last_30_days,
    MIN(created_at)                                                   AS oldest_thought,
    MAX(created_at)                                                   AS newest_thought
FROM thoughts;
