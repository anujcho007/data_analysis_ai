import json
import re
import time
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from app.core.database import engine
from app.models.dataset import DatasetMetadata
from app.config import UPLOAD_DIR

def find_primary_key_candidate(schema_info: List[Dict[str, Any]]) -> Optional[str]:
    """Find the best primary key candidate (100% unique, 0 nulls)."""
    unique_cols = [c["name"] for c in schema_info if c.get("is_unique") and c.get("null_count", 0) == 0]
    if not unique_cols:
        return None
    # Prefer columns ending with _id, id, _key, _code
    for col in unique_cols:
        col_lower = col.lower()
        if col_lower.endswith('_id') or col_lower in ['id', 'key', 'code', 'pk']:
            return col
    return unique_cols[0]

def classify_table_dynamically(df: pd.DataFrame, table_name: str, has_outgoing_foreign_keys: bool = False, is_referenced_by_others: bool = False) -> str:
    """
    Dynamically infers Fact vs Dimension role:
    - Dimension Table: Referenced as parent/lookup by other tables, or low/medium cardinality with descriptive columns.
    - Fact Table: References multiple dimension keys, or metric-dense (price, amount, quantity, cost), or child table.
    """
    if is_referenced_by_others and not has_outgoing_foreign_keys:
        return "dimension"
    if has_outgoing_foreign_keys:
        return "fact"

    cols = [str(c).lower() for c in df.columns]
    num_numeric = sum(1 for c in df.columns if hasattr(df[c], 'dtype') and pd.api.types.is_numeric_dtype(df[c]))
    num_cols = len(df.columns)

    fact_keywords = ['amount', 'price', 'total', 'sales', 'revenue', 'quantity', 'cost', 'profit', 'transaction', 'order', 'rating', 'score', 'qty']
    has_fact_metrics = any(any(kw in c for kw in fact_keywords) for c in cols)
    id_cols = [c for c in cols if c.endswith('_id') or c.endswith('_key') or c == 'id']

    if (has_fact_metrics and len(id_cols) >= 1) or (num_cols >= 3 and (num_numeric / num_cols) >= 0.5 and len(df) > 100):
        return "fact"
    return "dimension"

def save_dataframe_to_warehouse(
    db: Session,
    table_name: str,
    original_filename: str,
    df: pd.DataFrame,
    cleaning_summary: Dict[str, Any],
    schema_info: List[Dict[str, Any]]
) -> DatasetMetadata:
    """
    Saves cleaned DataFrame dynamically into SQLite database with bulk optimizations,
    indexes primary/foreign key candidates, and updates metadata table.
    """
    # Ensure any open transaction is committed before running DDL / table replacement
    db.commit()

    conn = db.connection()
    # Boost SQLite write speed for bulk ingestion
    try:
        conn.execute(text("PRAGMA synchronous = OFF"))
        conn.execute(text("PRAGMA journal_mode = WAL"))
        conn.execute(text("PRAGMA cache_size = -128000"))
        conn.execute(text("PRAGMA temp_store = MEMORY"))
    except Exception:
        pass

    # Write to SQLite in chunks using the session's active connection
    df.to_sql(table_name, con=conn, if_exists="replace", index=False, chunksize=50000)

    # Automatically index candidate keys to make joins and Star Schema instant
    try:
        sanitized_tbl = re.sub(r'[^a-zA-Z0-9_]', '', table_name)
        for col_info in schema_info:
            col_name = col_info.get("name", "")
            is_pk = col_info.get("is_unique", False) and col_info.get("null_count", 0) == 0
            is_key_suffix = col_name.lower().endswith(('_id', '_key', '_code')) or col_name.lower() in ['id', 'pk']
            if is_pk or is_key_suffix:
                sanitized_col = re.sub(r'[^a-zA-Z0-9_]', '', col_name)
                idx_name = f"idx_{sanitized_tbl}_{sanitized_col}"
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{sanitized_tbl}" ("{sanitized_col}")'))
    except Exception:
        pass

    # Restore safe synchronous mode
    try:
        conn.execute(text("PRAGMA synchronous = NORMAL"))
    except Exception:
        pass

    # Initial classification
    table_type = classify_table_dynamically(df, table_name)

    # Upsert metadata
    metadata = db.query(DatasetMetadata).filter(DatasetMetadata.table_name == table_name).first()
    if not metadata:
        metadata = DatasetMetadata(
            table_name=table_name,
            original_filename=original_filename,
            row_count=len(df),
            column_count=len(df.columns),
            table_type=table_type,
            schema_json=json.dumps(schema_info),
            cleaning_summary_json=json.dumps(cleaning_summary)
        )
        db.add(metadata)
    else:
        metadata.original_filename = original_filename
        metadata.row_count = len(df)
        metadata.column_count = len(df.columns)
        metadata.table_type = table_type
        metadata.schema_json = json.dumps(schema_info)
        metadata.cleaning_summary_json = json.dumps(cleaning_summary)

    db.commit()
    invalidate_star_schema_cache()
    db.refresh(metadata)
    return metadata

def normalize_key_name(col: str) -> str:
    """Normalize a key column name for fuzzy matching (e.g. food_id -> f_id, restaurant_id -> r_id)."""
    col_clean = col.lower().strip()
    # Normalize common abbreviations
    col_clean = re.sub(r'^food_id$', 'f_id', col_clean)
    col_clean = re.sub(r'^restaurant_id$', 'r_id', col_clean)
    col_clean = re.sub(r'^customer_id$', 'c_id', col_clean)
    col_clean = re.sub(r'^order_id$', 'o_id', col_clean)
    return col_clean

def check_value_intersection(conn, table1: str, col1: str, table2: str, col2: str) -> bool:
    """Safely verify that values in table1.col1 actually exist in table2.col2."""
    sanitized1 = re.sub(r'[^a-zA-Z0-9_]', '', table1)
    sanitized2 = re.sub(r'[^a-zA-Z0-9_]', '', table2)
    sanitized_col1 = re.sub(r'[^a-zA-Z0-9_]', '', col1)
    sanitized_col2 = re.sub(r'[^a-zA-Z0-9_]', '', col2)

    try:
        # Fast query without DISTINCT avoids scanning millions of rows on large tables
        sample_query = f'SELECT "{sanitized_col1}" FROM "{sanitized1}" WHERE "{sanitized_col1}" IS NOT NULL LIMIT 20'
        raw_samples = [row[0] for row in conn.execute(text(sample_query)).fetchall() if row[0] is not None]
        if not raw_samples:
            return False
        # Deduplicate small sample in Python memory (instant)
        samples = list(dict.fromkeys(raw_samples))[:5]
        placeholders = ','.join([f":s{i}" for i in range(len(samples))])
        params = {f"s{i}": s for i, s in enumerate(samples)}
        check_query = f'SELECT 1 FROM "{sanitized2}" WHERE "{sanitized_col2}" IN ({placeholders}) LIMIT 1'
        res = conn.execute(text(check_query), params).scalar()
        return res is not None
    except Exception:
        return False


_STAR_SCHEMA_CACHE = None
_STAR_SCHEMA_CACHE_TIMESTAMP = 0


def invalidate_star_schema_cache():
    """Invalidate in-memory Star Schema relationships cache."""
    global _STAR_SCHEMA_CACHE, _STAR_SCHEMA_CACHE_TIMESTAMP
    _STAR_SCHEMA_CACHE = None
    _STAR_SCHEMA_CACHE_TIMESTAMP = 0


def detect_star_schema_relationships(db: Session, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Dynamically analyzes all tables stored in the database to discover Star Schema relationships.
    Uses high-speed in-memory caching and optimized structural heuristics to avoid
    costly full-table scans on datasets with millions of rows.
    """
    global _STAR_SCHEMA_CACHE, _STAR_SCHEMA_CACHE_TIMESTAMP
    now = time.time()
    if not force_refresh and _STAR_SCHEMA_CACHE is not None and (now - _STAR_SCHEMA_CACHE_TIMESTAMP < 600):
        return _STAR_SCHEMA_CACHE

    db.commit()
    datasets = db.query(DatasetMetadata).all()
    if len(datasets) < 2:
        return []

    tables_info = {}
    for d in datasets:
        try:
            cols = json.loads(d.schema_json)
        except Exception:
            cols = []
        tables_info[d.table_name] = {
            "metadata_id": d.id,
            "table_name": d.table_name,
            "columns": cols,
            "col_names": [c["name"].lower() for c in cols],
            "row_count": d.row_count,
            "primary_key": find_primary_key_candidate(cols)
        }

    relationships = []
    table_names = list(tables_info.keys())
    seen_pairs = set()

    for i in range(len(table_names)):
        t1 = table_names[i]
        cols1 = tables_info[t1]["col_names"]
        t1_rows = tables_info[t1]["row_count"]

        for j in range(len(table_names)):
            if i == j:
                continue
            t2 = table_names[j]
            cols2 = tables_info[t2]["col_names"]
            t2_rows = tables_info[t2]["row_count"]
            pk2 = tables_info[t2]["primary_key"]

            # Strategy 1: Shared column name (e.g. f_id == f_id, r_id == r_id, customer_id == customer_id)
            common_cols = [c for c in cols1 if c in cols2]
            for col in common_cols:
                if col in ['name', 'status', 'type', 'description', 'created_at', 'updated_at', 'item', 'category', 'col_']:
                    continue

                is_key_like = (
                    col.endswith('_id') or col.endswith('_key') or col.endswith('_code') 
                    or col in ['id', 'f_id', 'r_id', 'm_id', 'u_id', 'o_id', 'c_id', 'p_id']
                    or col == pk2
                )

                if is_key_like:
                    pair_key = (t1, t2, col)
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    col_info_2 = next((c for c in tables_info[t2]["columns"] if c["name"].lower() == col), {})
                    is_unique_in_2 = col_info_2.get("is_unique", False) or (col == pk2)
                    r1 = t1_rows or 0
                    r2 = t2_rows or 0

                    if is_unique_in_2 or r1 >= r2:
                        relationships.append({
                            "source_table": t1,
                            "source_column": col,
                            "target_table": t2,
                            "target_column": col,
                            "relationship_type": "many-to-one"
                        })

            # Strategy 2: Entity matching (e.g. t1 has r_id or restaurant_id, and t2 is 'restaurant' with 'id')
            for col in cols1:
                is_key = (
                    col.endswith('_id') or col.endswith('_key') 
                    or col in ['f_id', 'r_id', 'm_id', 'u_id', 'o_id', 'c_id', 'p_id']
                )
                if not is_key:
                    continue

                target_col = pk2 or ('id' if 'id' in cols2 else None)
                if not target_col or col == target_col:
                    continue

                col_stem = col.replace('_id', '').replace('_key', '')
                matches_entity = (
                    col_stem == t2 
                    or (col == "r_id" and t2 == "restaurant")
                    or (col == "f_id" and t2 == "food")
                    or (col == "m_id" and t2 == "menu")
                    or (col == "o_id" and t2 == "orders")
                    or (col == "u_id" and t2 in ("users", "data_users"))
                    or (col == "c_id" and t2 in ("customer", "customers"))
                    or (len(col_stem) > 2 and col_stem in t2)
                    or (len(t2) > 2 and t2 in col_stem)
                )
                if matches_entity:
                    pair_key = (t1, t2, f"{col}->{target_col}")
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    relationships.append({
                        "source_table": t1,
                        "source_column": col,
                        "target_table": t2,
                        "target_column": target_col,
                        "relationship_type": "many-to-one"
                    })

    # Deduplicate relationships
    unique_rels = []
    seen = set()
    for rel in relationships:
        key = (rel["source_table"], rel["source_column"], rel["target_table"], rel["target_column"])
        if key not in seen:
            seen.add(key)
            unique_rels.append(rel)

    _STAR_SCHEMA_CACHE = unique_rels
    _STAR_SCHEMA_CACHE_TIMESTAMP = time.time()
    return unique_rels

def generate_dynamic_sample_queries(db: Session) -> List[Dict[str, str]]:
    """Generates analytical SQL sample queries tailored dynamically to the current warehouse schema."""
    datasets = db.query(DatasetMetadata).all()
    if not datasets:
        return []

    relationships = detect_star_schema_relationships(db)
    queries = []

    # 1. Preview query for the first table
    first_tbl = datasets[0].table_name
    queries.append({
        "label": f"Preview {first_tbl}",
        "query": f'SELECT * FROM "{first_tbl}" LIMIT 25;'
    })

    # 2. Join queries for each detected relationship
    for rel in relationships[:3]:
        src = rel["source_table"]
        tgt = rel["target_table"]
        src_col = rel["source_column"]
        tgt_col = rel["target_column"]

        queries.append({
            "label": f"Join {src} -> {tgt}",
            "query": f'SELECT\n  s.*,\n  t.*\nFROM "{src}" s\nJOIN "{tgt}" t ON s."{src_col}" = t."{tgt_col}"\nLIMIT 20;'
        })

    return queries

def get_table_data_preview(table_name: str, limit: int = 50, offset: int = 0, search: Optional[str] = None) -> Dict[str, Any]:
    """Fetch sample rows and columns from a warehouse table safely."""
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '', table_name)
    with engine.connect() as conn:
        count_res = conn.execute(text(f'SELECT COUNT(*) FROM "{sanitized}"'))
        total_rows = count_res.scalar() or 0

        query = f'SELECT * FROM "{sanitized}" LIMIT {limit} OFFSET {offset}'
        df = pd.read_sql(text(query), conn)
        df = df.where(pd.notnull(df), None)

        return {
            "table_name": sanitized,
            "total_rows": total_rows,
            "columns": list(df.columns),
            "rows": df.to_dict(orient="records")
        }

def run_sql_query(query: str) -> Dict[str, Any]:
    """Execute analytical SQL query on the warehouse."""
    clean_query = query.strip()
    if not clean_query.upper().startswith("SELECT") and not clean_query.upper().startswith("WITH"):
        raise ValueError("Only SELECT or WITH analytical queries are permitted.")

    start_time = time.time()
    with engine.connect() as conn:
        df = pd.read_sql(text(clean_query), conn)
        df = df.where(pd.notnull(df), None)

        # Make column names unique for joins with identical column names
        cols = list(df.columns)
        seen = {}
        unique_cols = []
        for c in cols:
            if c in seen:
                seen[c] += 1
                unique_cols.append(f"{c}_{seen[c]}")
            else:
                seen[c] = 0
                unique_cols.append(c)
        df.columns = unique_cols

        exec_time = round((time.time() - start_time) * 1000, 2)
        return {
            "columns": unique_cols,
            "rows": df.to_dict(orient="records"),
            "row_count": len(df),
            "execution_time_ms": exec_time
        }

def drop_all_warehouse_tables(db: Session = None):
    """
    Drops all user-created warehouse tables and clears DatasetMetadata.
    Preserves system tables ('users', 'dataset_metadata', 'sqlite_sequence').
    Uses direct autocommit connection to completely avoid SQLite transaction lock conflicts.
    """
    import sqlite3
    from app.config import DB_PATH
    reserved = {
        "users", "dataset_metadata", "sqlite_sequence", "sqlite_master", "sqlite_temp_master",
        "alert_rules", "alert_history", "workspaces", "workspace_members", "database_connections"
    }

    if db:
        try:
            db.commit()
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    # Direct raw SQLite in autocommit mode (isolation_level=None)
    # Autocommit mode is required for DDL in SQLite to avoid lock escalation failures
    try:
        with sqlite3.connect(DB_PATH.as_posix(), timeout=60, isolation_level=None) as raw_conn:
            raw_conn.execute("PRAGMA busy_timeout = 60000")
            cursor = raw_conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables_to_drop = [
                re.sub(r'[^a-zA-Z0-9_]', '', row[0])
                for row in cursor.fetchall()
                if row[0].lower() not in reserved
            ]
            for clean_tbl in tables_to_drop:
                if clean_tbl and clean_tbl.lower() not in reserved:
                    try:
                        cursor.execute(f'DROP TABLE IF EXISTS "{clean_tbl}"')
                    except Exception:
                        pass
            cursor.close()
    except Exception:
        pass

    # Clear DatasetMetadata records
    if db:
        try:
            db.query(DatasetMetadata).delete()
            db.commit()
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
    else:
        from app.core.database import SessionLocal
        with SessionLocal() as s:
            try:
                s.query(DatasetMetadata).delete()
                s.commit()
            except Exception:
                s.rollback()
    invalidate_star_schema_cache()


