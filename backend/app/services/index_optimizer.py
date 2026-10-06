import re
import sys
import sqlite3
import logging
from typing import Dict, List, Any
from app.config import DB_PATH

logger = logging.getLogger(__name__)

TEMPORAL_PATTERNS = ('_date', '_time', '_at', 'timestamp', 'date', 'datetime', 'order_date', 'created_at', 'updated_at')
KEY_PATTERNS = ('_id', '_key', '_code')

def optimize_warehouse_indexes() -> Dict[str, Any]:
    """
    Scans all tables in the analytical warehouse and creates missing B-Tree indexes
    for candidate keys, foreign keys, and temporal/date columns.
    Optimized for high-throughput tables (10M - 25M rows) via memory cache pragmas.
    """
    if not DB_PATH.exists():
        return {"status": "skipped", "message": "Warehouse database does not exist yet."}

    conn = sqlite3.connect(str(DB_PATH), timeout=60.0)
    conn.execute("PRAGMA busy_timeout=60000;")
    conn.execute("PRAGMA cache_size = -128000;")  # 128 MB RAM cache
    conn.execute("PRAGMA temp_store = MEMORY;")   # Fast RAM sorting for B-Trees
    conn.execute("PRAGMA synchronous = NORMAL;")
    cursor = conn.cursor()

    system_tables = {
        'sqlite_sequence', 'sqlite_stat1', 'sqlite_stat4',
        'dataset_metadata', 'users', 'alert_rules', 'alert_history',
        'workspaces', 'workspace_members', 'database_connections'
    }

    tables_res = cursor.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
    tables = [r[0] for r in tables_res if r[0] not in system_tables]

    total_indexes_created = 0
    details = []

    for tbl in tables:
        sanitized_tbl = re.sub(r'[^a-zA-Z0-9_]', '', tbl)
        print(f"Inspecting table: {sanitized_tbl}...", flush=True)
        
        # Get column info
        cols_info = cursor.execute(f'PRAGMA table_info("{sanitized_tbl}");').fetchall()
        
        # Get existing index names
        existing_indexes = cursor.execute(f'PRAGMA index_list("{sanitized_tbl}");').fetchall()
        existing_idx_names = {r[1] for r in existing_indexes}

        tbl_created = []

        for col in cols_info:
            col_name = col[1]
            col_lower = col_name.lower()
            is_key = col_lower.endswith(KEY_PATTERNS) or col_lower in ['id', 'pk']
            is_temporal = any(col_lower.endswith(sfx) or col_lower == sfx for sfx in TEMPORAL_PATTERNS)

            if is_key or is_temporal:
                sanitized_col = re.sub(r'[^a-zA-Z0-9_]', '', col_name)
                idx_name = f"idx_{sanitized_tbl}_{sanitized_col}"
                
                if idx_name not in existing_idx_names:
                    try:
                        print(f"  Creating index {idx_name} on {sanitized_tbl}({sanitized_col})...", flush=True)
                        cursor.execute(f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{sanitized_tbl}" ("{sanitized_col}");')
                        tbl_created.append(sanitized_col)
                        total_indexes_created += 1
                        conn.commit()  # commit per index
                        print(f"  Index {idx_name} created successfully.", flush=True)
                    except Exception as e:
                        logger.warning(f"Failed to create index {idx_name}: {e}")
                        print(f"  Failed: {e}", flush=True)

        if tbl_created:
            details.append({"table": sanitized_tbl, "indexed_columns": tbl_created})

    conn.close()

    return {
        "status": "success",
        "tables_scanned": len(tables),
        "indexes_created": total_indexes_created,
        "details": details
    }

if __name__ == "__main__":
    result = optimize_warehouse_indexes()
    print("Optimization Result:", result, flush=True)
