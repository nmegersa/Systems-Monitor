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


def sample_metrics():
    # Timestamp
    ts = datetime.now(timezone.utc)

    # CPU metrics
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_per_core_percent = [float(x) for x in psutil.cpu_percent(interval=None, percpu=True)]
    cpu_times = psutil.cpu_times_percent(interval=None, percpu=False)
    cpu_user_percent = float(cpu_times.user) 
    cpu_system_percent = float(cpu_times.system)
    
    load_1 = load_5 = load_15 = None
    try:
        load_1, load_5, load_15 = os.getloadavg()
    except AttributeError:
        pass

    # Memory metrics
    virtualmem = psutil.virtual_memory()
    mem_percent = float(virtualmem.percent)
    mem_total_bytes = int(virtualmem.total)
    mem_used_bytes = int(virtualmem.used)
    mem_free_bytes = int(virtualmem.free)
    mem_available_bytes = int(virtualmem.available)
    
    # Disk metrics
    disk_mount = "/" # Disk mount point (root)
    disk_usage = psutil.disk_usage(disk_mount)
    disk_percent = float(disk_usage.percent)
    disk_total_bytes = int(disk_usage.total)
    disk_used_bytes = int(disk_usage.used)
    disk_free_bytes = int(disk_usage.free)
   
    return {
        "ts": ts,

        # CPU
        "cpu_percent": float(cpu_percent),
        "cpu_user_percent": float(cpu_user_percent),
        "cpu_system_percent": float(cpu_system_percent),
        "load_1": load_1, "load_5": load_5, "load_15": load_15,
        "cpu_per_core_percent": cpu_per_core_percent,
        
        # Memory
        "mem_percent": float(mem_percent),
        "mem_total_bytes": mem_total_bytes,
        "mem_used_bytes": mem_used_bytes,
        "mem_free_bytes": mem_free_bytes,
        "mem_available_bytes": mem_available_bytes,

        # Disk
        "disk_mount": disk_mount,
        "disk_percent": disk_percent,
        "disk_total_bytes": disk_total_bytes,
        "disk_used_bytes": disk_used_bytes,
        "disk_free_bytes": disk_free_bytes,
    }

def flush_batch(cur, batch):
    """
    Insert a batch into Postgres.
    """
    sql = """
        INSERT INTO metrics (ts, cpu_percent, cpu_per_core_percent, cpu_user_percent, cpu_system_percent, load_1, load_5, load_15,
                             mem_percent, mem_total_bytes, mem_used_bytes, mem_free_bytes, mem_available_bytes,
                             disk_mount, disk_percent, disk_total_bytes, disk_used_bytes, disk_free_bytes)
        VALUES %s
    """
    execute_values(cur, sql, batch)

def bytes_to_gb(b: int) -> float:
    return b / (1024 ** 3)

def fmt_gb(b: int) -> str:
    return f"{bytes_to_gb(b):.1f} GB"

def fmt_opt(x) -> str:
    return "n/a" if x is None else f"{x:.2f}"

def print_sample(s: dict):
    ts_local = s["ts"].astimezone().strftime("%H:%M:%S")
    cores = s["cpu_per_core_percent"] or []
    cores_preview = ", ".join(f"{c:.0f}%" for c in cores[:8]) + ("..." if len(cores) > 8 else "")

    print(
        f"\n[{ts_local}]"
        f"\nCPU:"
        f"\n  total:  {s['cpu_percent']:.1f}%"
        f"\n  user:   {s['cpu_user_percent']:.1f}%"
        f"\n  system: {s['cpu_system_percent']:.1f}%"
        f"\n  load:   {fmt_opt(s['load_1'])}, {fmt_opt(s['load_5'])}, {fmt_opt(s['load_15'])}"
        f"\n  cores:  {cores_preview}"
        f"\nMemory:"
        f"\n  used:   {s['mem_percent']:.1f}%  ({fmt_gb(s['mem_used_bytes'])} / {fmt_gb(s['mem_total_bytes'])})"
        f"\n  free:   {fmt_gb(s['mem_free_bytes'])}   available: {fmt_gb(s['mem_available_bytes'])}"
        f"\nDisk ({s['disk_mount']}):"
        f"\n  used:   {s['disk_percent']:.1f}%  ({fmt_gb(s['disk_used_bytes'])} / {fmt_gb(s['disk_total_bytes'])})"
        f"\n  free:   {fmt_gb(s['disk_free_bytes'])}\n"
    )


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

    batch = []

    try:
        with conn:
            with conn.cursor() as cur:
                while not stop["flag"]:
                    s = sample_metrics()
                    batch.append((
                    s["ts"],
                    s["cpu_percent"], s["cpu_per_core_percent"], s["cpu_user_percent"], s["cpu_system_percent"], s["load_1"], s["load_5"], s["load_15"],
                    s["mem_percent"], s["mem_total_bytes"], s["mem_used_bytes"], s["mem_free_bytes"], s["mem_available_bytes"],
                    s["disk_mount"], s["disk_percent"], s["disk_total_bytes"], s["disk_used_bytes"], s["disk_free_bytes"],
                    ))

                    # A tiny heartbeat so you know it’s running
                    if len(batch) == 1:
                        print_sample(s)
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
