# Systems-Monitor

**Systems-Monitor** is a containerized system monitoring application that collects, stores, and visualizes system metrics such as CPU usage, memory usage, and disk utilization.

This project demonstrates a full-stack monitoring pipeline using **Docker Compose**, a **Python sampling agent**, a **Node.js backend**, and a **PostgreSQL database**, with a dashboard that includes **interactive charts built with Chart.js**.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Features](#features)
3. [How It Works](#how-it-works)
4. [Tech Stack](#tech-stack)
5. [Repository Structure](#repository-structure)
6. [Configuration](#configuration)
7. [Run with Docker Compose](#run-with-docker-compose)
8. [What I Learned](#what-i-learned)
9. [Future Improvements (Roadmap)](#future-improvements-roadmap)
10. [License](#license)
11. [Author](#author)

---

## Project Overview

Many monitoring tools hide how metrics are collected and stored. Systems-Monitor was built to explore and practice:

- **Sampling system metrics** on a schedule.
- **Persisting time-series data** in a relational database.
- **Querying and serving metrics** through a backend service.
- **Visualizing metrics** with interactive time-series charts.
- **Orchestrating services** reliably using Docker Compose.

---

## Features

### 🧠 Metric Collection (Python Sampler)
- Python-based sampler that runs on a configurable interval.
- Collects core system metrics: **CPU**, **Memory**, and **Disk usage**.
- Configurable via environment variables (`SAMPLE_INTERVAL`, `BATCH_SIZE`).
- Writes metrics **directly to PostgreSQL** for high-performance ingestion.

### 🗄️ Persistent Storage (PostgreSQL)
- Stores timestamped metric records.
- Optimized for querying latest snapshots and historical trends.

### 🌐 Backend Service (Node.js)
- Acts as the main application entrypoint.
- Queries the database and serves data via a REST API.
- Provides server-rendered pages for the dashboard UI.

### 📊 Dashboard + Charts (Chart.js)
- Interactive web dashboard using **Chart.js**.
- Visualizes "latest" behavior and recent history trends to identify spikes.

### 🐳 Dockerized Architecture
- Entire stack managed by **Docker Compose**.
- Isolated networking for secure service-to-service communication.

---

## How It Works



**High-level data flow:**

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
│  Backend   │  (Node.js/Python)
│  API + UI  │
└─────┬──────┘
      │
      ▼
┌────────────┐
│ Dashboard  │  (Browser + Chart.js)
└────────────┘

-- 

The Python sampler gathers system metrics every few seconds.

It inserts these records into the PostgreSQL database.

The Node.js backend queries the database for the requested time range.

The Dashboard renders the results into interactive graphs.

Tech Stack
Languages

Python: Metric sampling agent logic.

JavaScript (Node.js): Backend API, server-side logic, and frontend charts.

SQL: Database schema management and metric queries.

Tools & Infrastructure

Docker & Docker Compose: Service orchestration.

PostgreSQL: Relational storage for time-series data.

Express.js: Web framework for the Node.js backend.

Chart.js: Frontend data visualization.

Repository Structure
Plaintext
Systems-Monitor/
├── api/                # Backend API routes and handlers
├── db/                 # SQL schema and setup scripts
├── sampler/            # Python metric sampler service
├── views/              # UI templates (EJS/HTML)
├── frontend/static/    # CSS and Client-side JS
├── docker-compose.yaml  # Orchestration config
├── Dockerfile           # Backend container build instructions
├── server.js            # Node.js entrypoint
├── .env.example         # Template for environment variables
└── README.md            # Project documentation
Configuration
Copy .env.example to a new file named .env and update the values. Do not commit your .env file to version control.

Key Variables:

Database: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, DB_HOST, DB_PORT.

Sampler: SAMPLE_INTERVAL (seconds between samples), BATCH_SIZE (rows per insert).

Run with Docker Compose
Prerequisites

Docker installed

Docker Compose installed

Installation & Launch

Clone the repository.

Create your .env file.

Run the following command:

Bash
docker compose up --build
Access the App

Once the containers are running, open your browser to: http://localhost:8000

What I Learned
Service Decoupling: How to separate a data-producer (Sampler) from a data-consumer (Backend).

Time-Series Management: Handling timestamped data in a standard relational database.

Container Networking: Using Docker Compose to let services talk to each other by service name.

Data Visualization: Mapping raw database rows to Chart.js datasets.

Future Improvements (Roadmap)
⏳ Data Pruning: Implement a background job to archive or delete data older than 30 days.

🔔 Alerting: Integration with Discord/Slack webhooks when CPU exceeds 90%.

📡 Extended Metrics: Adding Network I/O and per-process resource tracking.

🔐 Auth: Adding a simple login layer to protect the dashboard.

License
This project is licensed under the MIT License.

Author
Built with 💡 by Nathan Megersa