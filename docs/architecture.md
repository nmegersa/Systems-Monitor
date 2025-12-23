# Systems Monitor Architecture

## High-level data flow
Sampler (psutil) → Postgres (metrics table) → API (FastAPI) → Web UI (tables + charts)

## Components
### Sampler
- Reads system metrics on an interval (CPU, memory, disk)
- Writes rows into the database
- Key configs: `SAMPLE_INTERVAL`, `BATCH_SIZE`

### API
- Reads from the database
- Exposes:
  - `GET /api/latest` for the newest row
  - `GET /api/range?minutes=N` for a window of points

### Web UI
- Polls the API (auto-refresh in latest mode)
- Renders:
  - tables for current stats
  - charts for time-series

## Networking rule (common pitfall)
- **Container → container** DB connections should use Postgres container port: **5432**
- **Your laptop → container** uses the mapped host port (ex: **5433**) if your compose maps `5433:5432`
