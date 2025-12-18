CREATE TABLE IF NOT EXISTS metrics (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), -- timestamp (wall clock)

    -- CPU (percent + breakdown + load + per-core)
    cpu_percent REAL NOT NULL CHECK (cpu_percent >= 0 AND cpu_percent <= 100),
    cpu_user_percent REAL CHECK (cpu_user_percent IS NULL OR (cpu_user_percent >= 0 AND cpu_user_percent <= 100)),
    cpu_system_percent REAL CHECK (cpu_system_percent IS NULL OR (cpu_system_percent >= 0 AND cpu_system_percent <= 100)),
    load_1 REAL,
    load_5 REAL,
    load_15 REAL,
    cpu_per_core_percent REAL[], -- array of per-core usage percentages

    -- Memory (percent + absolute bytes)
    mem_percent REAL NOT NULL CHECK (mem_percent >= 0 AND mem_percent <= 100),
    mem_total_bytes BIGINT CHECK (mem_total_bytes IS NULL OR mem_total_bytes >= 0),
    mem_used_bytes BIGINT CHECK (mem_used_bytes IS NULL OR mem_used_bytes >= 0),
    mem_free_bytes BIGINT CHECK (mem_free_bytes IS NULL OR mem_free_bytes >= 0),
    mem_available_bytes BIGINT CHECK (mem_available_bytes IS NULL OR mem_available_bytes >= 0),

    -- Disk (percent + absolute bytes)
    disk_percent REAL NOT NULL CHECK (disk_percent >= 0 AND disk_percent <= 100),
    disk_total_bytes BIGINT CHECK (disk_total_bytes IS NULL OR disk_total_bytes >= 0),
    disk_used_bytes BIGINT CHECK (disk_used_bytes IS NULL OR disk_used_bytes >= 0),
    disk_free_bytes BIGINT CHECK (disk_free_bytes IS NULL OR disk_free_bytes >= 0),
    disk_mount TEXT -- mount point (e.g., "/")
);

CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics(ts);