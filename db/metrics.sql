CREATE TABLE IF NOT EXISTS metrics (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- timestamp
    cpu_percent REAL NOT NULL CHECK (cpu_percent >= 0 AND cpu_percent <= 100),
    mem_percent REAL NOT NULL CHECK (mem_percent >= 0 AND mem_percent <= 100),
    disk_percent REAL NOT NULL CHECK (disk_percent >= 0 AND disk_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics(ts);