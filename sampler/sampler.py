import os
import time
import signal
from dataclasses import dataclass
from datetime import datetime, timezone

import psutil
import psycopg2
from psycopg2.extras import execute_values


@dataclass
class Config:
    host: str
    port: int
    dbname: str
    user: str
    password: str 
    interval_s: float
    batch_size: int


def load_config() -> Config:
    """
    Reads configuration from env variables.

    NOTE:
    - This does NOT load a .env file by itself.
    - In Docker Compose, env_file: .env loads vars into the container.
    - When running locally, you can export vars in your shell OR use a .env file
      (but do not commit it).
    """
    return Config(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5433")),
        dbname=os.getenv("DB_NAME", "systems_monitor"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "pwd"),  # default for your setup
        interval_s=float(os.getenv("SAMPLE_INTERVAL", "2")),
        batch_size=int(os.getenv("BATCH_SIZE", "10")),
    )


def connect(cfg: Config):
    """Open a connection to Postgres."""
    return psycopg2.connect(
        host=cfg.host,
        port=cfg.port,
        dbname=cfg.dbname,
        user=cfg.user,
        password=cfg.password,
    )


def sample_metrics() -> tuple[float, float, float]:
    """Collect one sample (cpu%, mem%, disk%)."""
    cpu = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory().percent
    disk = psutil.disk_usage("/").percent
    return cpu, mem, disk


def flush_batch(cur, batch: list[tuple[datetime, float, float, float]]):
    """
    Insert a batch into Postgres.
    """
    sql = """
        INSERT INTO metrics (ts, cpu_percent, mem_percent, disk_percent)
        VALUES %s
    """
    execute_values(cur, sql, batch)


def main():
    cfg = load_config()

    # Stop flag for graceful shutdown (Ctrl+C)
    stop = {"flag": False}

    def _handle_stop(signum, frame):
        stop["flag"] = True

    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)

    # Warm CPU measurement so future cpu_percent calls are meaningful
    psutil.cpu_percent(interval=None)

    # Print only non-sensitive connection info (NO password)
    print(
        "Sampler starting:\n"
        f"  interval={cfg.interval_s}s\n"
        f"  batch_size={cfg.batch_size}\n"
        f"  db={cfg.user}@{cfg.host}:{cfg.port}/{cfg.dbname}\n"
    )

    # Retry connect (useful if Postgres is still booting)
    conn = None
    for attempt in range(1, 31):
        try:
            conn = connect(cfg)
            conn.autocommit = False
            break
        except Exception as e:
            if attempt == 30:
                raise
            print(f"[db] connect failed (attempt {attempt}/30): {e}")
            time.sleep(1)

    batch: list[tuple[datetime, float, float, float]] = []

    try:
        with conn:
            with conn.cursor() as cur:
                while not stop["flag"]:
                    cpu, mem, disk = sample_metrics()
                    ts = datetime.now(timezone.utc)
                    batch.append((ts, cpu, mem, disk))

                    # A tiny heartbeat so you know it’s running
                    if len(batch) == 1:
                        print(f"sample: cpu={cpu:.1f}% mem={mem:.1f}% disk={disk:.1f}%")

                    # Insert once we hit batch_size
                    if len(batch) >= cfg.batch_size:
                        flush_batch(cur, batch)
                        conn.commit()
                        batch.clear()

                    time.sleep(cfg.interval_s)

                # Flush remaining rows on shutdown
                if batch:
                    flush_batch(cur, batch)
                    conn.commit()
                    batch.clear()

    finally:
        if conn is not None:
            conn.close()

    print("Sampler stopped cleanly.") 

if __name__ == "__main__":
    main()
