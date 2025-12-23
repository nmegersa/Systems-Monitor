# Setup (Systems-Monitor)

This project is a small system-monitoring stack with:
- a Node.js server (`server.js`)
- a backend API layer (`/api`)
- a sampler/agent (`/sampler`) that collects metrics
- a database layer (`/db`)
- a UI rendered from templates (`/views`) plus static assets (`/frontend/static`)
- optional Docker support (`Dockerfile`, `docker-compose.yaml`) :contentReference[oaicite:1]{index=1}

---

## Quick Start (Docker)

> Use this if you want the fastest “just run it” setup.

### 1) Prereqs
- Docker Desktop (or Docker Engine + Docker Compose)

### 2) Run
From the repo root:

```bash
docker compose up --build
