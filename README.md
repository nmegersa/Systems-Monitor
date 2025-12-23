## Systems-Monitor

A small, containerized system-monitoring demo that samples host metrics, stores them in PostgreSQL, and visualizes them on a dashboard.

This repository contains a Python sampler, a backend service, a Postgres schema, and a lightweight web dashboard.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [How It Works](#how-it-works)
4. [Tech Stack](#tech-stack)
5. [Repository Structure](#repository-structure)
6. [Configuration](#configuration)
7. [Run with Docker Compose](#run-with-docker-compose)
8. [What I Learned](#what-i-learned)
9. [Future Improvements (roadmap)](#future-improvements-roadmap)
10. [License](#license)
11. [Author](#author)

---

## Project Overview

Systems-Monitor collects metrics (CPU, memory, disk) with a scheduled Python sampler that writes to PostgreSQL. A backend service serves the data and a small dashboard (Chart.js) visualizes recent trends.

Key goals:

- Demonstrate scheduled metric sampling and ingestion
- Persist and query time-series metrics in a relational DB
- Present interactive visualizations in a simple dashboard
- Run the full stack via Docker Compose

## Features

- Python sampler: configurable interval and batch insert behavior
- PostgreSQL schema tuned for timestamped metric records
- Backend (Node.js) exposing REST/API endpoints + server-rendered dashboard
- Frontend: Chart.js charts for time-series visualization
- Dockerized: compose file for local dev and testing

## How it works

High-level data flow (diagram):

```text
┌────────────┐
│  Sampler   │  (Python)
│  (metrics) │
└─────┬──────┘
      │  (direct DB writes)
      ▼
┌────────────┐
│  Database  │  (PostgreSQL)
│  (metrics) │
└─────┬──────┘
      │  (reads/queries)
      ▼
┌────────────┐
│  Backend   │  (Node.js / Python)
│  API + UI  │
└─────┬──────┘
      │
      ▼
┌────────────┐
│ Dashboard  │  (Browser + Chart.js)
└────────────┘
```

The sampler periodically collects host metrics and inserts them into Postgres. The backend queries the DB and exposes endpoints used by the dashboard to render charts.

## Tech stack

- Languages: Python (sampler), JavaScript/Node.js (backend + frontend), SQL
- Database: PostgreSQL
- Web: Express.js (backend), Chart.js (frontend)
- Orchestration: Docker & Docker Compose

## Repository structure

The main repository layout (top-level):

```text
Systems-Monitor/

├── api/                # Backend API and server code (Python and/or Node routes)
├── db/                 # SQL schema and setup scripts
├── sampler/            # Python metric sampler service
├── views/              # UI templates (Handlebars: .hbs)
├── frontend/static/    # CSS and client-side JS (dashboard)
├── docker-compose.yaml # Compose orchestration config
├── Dockerfile          # Backend container build instructions
├── server.js           # Node.js entrypoint
├── .env.example        # Template for environment variables
└── README.md           # Project documentation
```

## Configuration

1. Copy `.env.example` to `.env` and update values. Keep `.env` out of version control.

Important variables:

- Database: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_HOST`, `DB_PORT`
- Sampler: `SAMPLE_INTERVAL` (seconds between samples), `BATCH_SIZE` (rows per insert)

## Run with Docker Compose

Prerequisites:

- Docker installed
- Docker Compose available

Quick start:

1. Clone the repo and create your `.env` from `.env.example`.
2. Build and start the stack with `docker compose up --build`.

When the containers are running, open http://localhost:8000 (or the port configured in your `.env`).

## What I learned

- Service decoupling: separating sampler (producer) from backend (consumer)
- Time-series handling in a relational DB
- Container networking with Docker Compose
- Mapping DB rows to Chart.js datasets for visualization

## Future improvements (roadmap)

- Data pruning/archival for long-term storage
- Alerting (Slack/Discord/webhooks) on high CPU usage
- Additional metrics: network I/O and per-process stats
- Optional authentication for the dashboard

## License

This project is licensed under the MIT License.

## Author

Built with 💡 by Nathan Megersa
