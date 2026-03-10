-- Open Brain v3 Migration — Relationship Graph
-- Adds: thought_relationships table (extends, infers, contradicts)

CREATE TABLE IF NOT EXISTS thought_relationships (
    id         BIGSERIAL PRIMARY KEY,
    from_id    BIGINT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
    to_id      BIGINT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('extends', 'infers', 'contradicts')),
    reason     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (from_id, to_id, type)
);

CREATE INDEX IF NOT EXISTS rel_from_idx ON thought_relationships (from_id);
CREATE INDEX IF NOT EXISTS rel_to_idx   ON thought_relationships (to_id);
CREATE INDEX IF NOT EXISTS rel_type_idx ON thought_relationships (type);

-- Get all thoughts related to a given thought (both directions)
CREATE OR REPLACE FUNCTION get_related_thoughts(p_thought_id BIGINT)
RETURNS TABLE (
    id            BIGINT,
    content       TEXT,
    metadata      JSONB,
    created_at    TIMESTAMPTZ,
    event_date    TIMESTAMPTZ,
    superseded_by BIGINT,
    rel_type      TEXT,
    rel_reason    TEXT,
    direction     TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    -- Outgoing: this thought relates TO others
    SELECT t.id, t.content, t.metadata, t.created_at, t.event_date, t.superseded_by,
           r.type, r.reason, 'outgoing'::TEXT
    FROM thought_relationships r
    JOIN thoughts t ON t.id = r.to_id
    WHERE r.from_id = p_thought_id

    UNION ALL

    -- Incoming: other thoughts relate TO this thought
    SELECT t.id, t.content, t.metadata, t.created_at, t.event_date, t.superseded_by,
           r.type, r.reason, 'incoming'::TEXT
    FROM thought_relationships r
    JOIN thoughts t ON t.id = r.from_id
    WHERE r.to_id = p_thought_id

    ORDER BY created_at DESC;
END;
$$;

-- Updated stats view with relationship counts
CREATE OR REPLACE VIEW brain_stats AS
SELECT
    COUNT(DISTINCT t.id)                                                     AS total_thoughts,
    COUNT(DISTINCT t.id) FILTER (WHERE t.superseded_by IS NULL)             AS active_thoughts,
    COUNT(DISTINCT t.id) FILTER (WHERE t.superseded_by IS NOT NULL)         AS superseded_thoughts,
    COUNT(DISTINCT t.id) FILTER (WHERE t.created_at >= NOW() - INTERVAL '7 days'
                                   AND t.superseded_by IS NULL)             AS thoughts_last_7_days,
    COUNT(DISTINCT t.id) FILTER (WHERE t.created_at >= NOW() - INTERVAL '30 days'
                                   AND t.superseded_by IS NULL)             AS thoughts_last_30_days,
    (SELECT COUNT(*) FROM thought_relationships)                             AS total_relationships,
    (SELECT COUNT(*) FROM thought_relationships WHERE type = 'extends')     AS extends_count,
    (SELECT COUNT(*) FROM thought_relationships WHERE type = 'infers')      AS infers_count,
    (SELECT COUNT(*) FROM thought_relationships WHERE type = 'contradicts') AS contradicts_count,
    MIN(t.created_at)                                                        AS oldest_thought,
    MAX(t.created_at)                                                        AS newest_thought
FROM thoughts t;
