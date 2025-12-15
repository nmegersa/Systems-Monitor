import os
from typing import List, Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor


#Data Models
class MetricRow(BaseModel):
    id: int
    ts: datetime               # TIMESTAMPTZ will serialize nicely as ISO string
    cpu_percent: float
    mem_percent: float
    disk_percent: float


class LatestResponse(BaseModel):
    latest: MetricRow


class RangeResponse(BaseModel):
    points: List[MetricRow]

#App middleware and setup
app = FastAPI(title="Systems Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # your frontend dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Load DB config from env variables
def load_db_config() -> dict:
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5433")),
        "dbname": os.getenv("DB_NAME", "systems_monitor"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "pwd"),
    }


#Database connection
def get_db_connection():
    """
    Create and return a psycopg2 connection using load_db_config().
    Use RealDictCursor so rows come back like dicts (key/value).
    """
    cfg = load_db_config()
    conn = psycopg2.connect(
        host=cfg["host"],
        port=cfg["port"],
        dbname=cfg["dbname"],
        user=cfg["user"],
        password=cfg["password"],
    )
    return conn

#Query functions
def fetch_latest_metric(conn) -> Optional[MetricRow]:
    """Fetch the latest metric row from the database."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, ts, cpu_percent, mem_percent, disk_percent
            FROM metrics
            ORDER BY ts DESC
            LIMIT 1;
            """
        )
        row = cur.fetchone()
        if row:
            return MetricRow(**row)
        else:
            return None

def fetch_metrics_range(conn, minutes: int, limit: int) -> List[MetricRow]:
    """
    Fetch metric rows from the last `minutes` minutes, limited to `limit` rows.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, ts, cpu_percent, mem_percent, disk_percent
            FROM metrics
            WHERE ts >= now() - (%s * interval '1 minute')
            ORDER BY ts ASC
            LIMIT %s;
            """,
            (minutes, limit)
            )
        rows = cur.fetchall()
        return [MetricRow(**row) for row in rows]
        
def not_found_if_empty(rows):
    """
    If no metrics exist yet, raise an HTTPException(404, ...).
    """
    if not rows:
        raise HTTPException(status_code=404, detail="No metrics found")

        
#API Endpoints
@app.get("/api/health")
def health():
    """
    Health check endpoint
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
            check = cur.fetchone() is not None
        if check:
            return {"status": "ok"}
        else:
            raise HTTPException(status_code=500, detail="Database check failed")        
    finally:
        conn.close()

@app.get("/api/latest", response_model=LatestResponse)
def get_latest_metric():
    """
    Return the newest metric row from the database.
    """
    conn = get_db_connection()
    try:
        latest_metric = fetch_latest_metric(conn)
        not_found_if_empty([latest_metric] if latest_metric else [])
        return LatestResponse(latest=latest_metric)
    finally:
        conn.close()
        
@app.get("/api/range", response_model=RangeResponse)
def range_(
    minutes: int = Query(15, ge=1, le=24*60),
    limit: int = Query(2000, ge=1, le=20000),
):
    """
    Returns metric rows from the last `minutes` minutes (up to `limit` rows).
    """
    conn = get_db_connection()
    try:
        rows = fetch_metrics_range(conn, minutes, limit)
        not_found_if_empty(rows)
        return RangeResponse(points=rows)
    finally:
        conn.close()

