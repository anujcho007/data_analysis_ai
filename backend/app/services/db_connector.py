import time
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.services.cleaner import clean_dataframe, clean_column_name
from app.services.schema_builder import (
    save_dataframe_to_warehouse,
    detect_star_schema_relationships
)

def build_connection_url(
    db_type: str,
    host: Optional[str],
    port: Optional[int],
    database_name: str,
    username: Optional[str],
    password: Optional[str],
    ssl_mode: Optional[str] = "prefer"
) -> str:
    """Safely builds SQLAlchemy database URL for PostgreSQL, MySQL, or SQLite."""
    db_clean = db_type.lower().strip()
    
    enc_user = urllib.parse.quote_plus(username) if username else ""
    enc_pass = urllib.parse.quote_plus(password) if password else ""
    auth = f"{enc_user}:{enc_pass}@" if enc_user else ""

    if db_clean in ["postgres", "postgresql"]:
        port_num = port or 5432
        url = f"postgresql+psycopg2://{auth}{host}:{port_num}/{database_name}"
        if ssl_mode and ssl_mode != "disable":
            url += f"?sslmode={ssl_mode}"
        return url

    elif db_clean in ["mysql", "mariadb"]:
        port_num = port or 3306
        return f"mysql+pymysql://{auth}{host}:{port_num}/{database_name}"

    elif db_clean == "sqlite":
        return f"sqlite:///{database_name}"

    raise ValueError(f"Unsupported database connector type: '{db_type}'. Supported types: postgresql, mysql, sqlite.")


def test_remote_database(
    db_type: str,
    host: Optional[str],
    port: Optional[int],
    database_name: str,
    username: Optional[str],
    password: Optional[str],
    ssl_mode: Optional[str] = "prefer"
) -> Dict[str, Any]:
    """Tests connection to remote database, measures latency, and inspects server version."""
    start_time = time.time()
    url = build_connection_url(db_type, host, port, database_name, username, password, ssl_mode)

    engine = create_engine(url, connect_args={"connect_timeout": 8} if "sqlite" not in url else {})
    try:
        with engine.connect() as conn:
            # Query server version
            if "sqlite" in url:
                version_raw = conn.execute(text("SELECT sqlite_version()")).scalar()
                server_ver = f"SQLite {version_raw}"
            elif "mysql" in url:
                version_raw = conn.execute(text("SELECT VERSION()")).scalar()
                server_ver = f"MySQL/MariaDB {version_raw}"
            else:
                version_raw = conn.execute(text("SELECT version()")).scalar()
                server_ver = str(version_raw).split(",")[0] if version_raw else "PostgreSQL"

            insp = inspect(engine)
            tables = insp.get_table_names()

        latency_ms = round((time.time() - start_time) * 1000, 1)
        return {
            "success": True,
            "latency_ms": latency_ms,
            "server_version": server_ver,
            "table_count": len(tables),
            "sample_tables": tables[:8]
        }
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000, 1)
        return {
            "success": False,
            "latency_ms": latency_ms,
            "error": str(e)
        }
    finally:
        engine.dispose()


def get_remote_tables_info(
    db_type: str,
    host: Optional[str],
    port: Optional[int],
    database_name: str,
    username: Optional[str],
    password: Optional[str],
    ssl_mode: Optional[str] = "prefer"
) -> List[Dict[str, Any]]:
    """Inspects remote database tables, column names, and estimated row counts."""
    url = build_connection_url(db_type, host, port, database_name, username, password, ssl_mode)
    engine = create_engine(url, connect_args={"connect_timeout": 8} if "sqlite" not in url else {})
    
    tables_list = []
    try:
        insp = inspect(engine)
        table_names = insp.get_table_names()

        with engine.connect() as conn:
            for t_name in table_names:
                try:
                    cols = [c["name"] for c in insp.get_columns(t_name)]
                    # Fast row count
                    count_q = text(f'SELECT count(*) FROM "{t_name}"') if "postgres" in url else text(f'SELECT count(*) FROM `{t_name}`') if "mysql" in url else text(f'SELECT count(*) FROM "{t_name}"')
                    row_count = conn.execute(count_q).scalar() or 0
                except Exception:
                    row_count = 0
                    cols = []

                tables_list.append({
                    "table_name": t_name,
                    "column_count": len(cols),
                    "columns": cols[:10],
                    "row_count": row_count
                })
        return tables_list
    finally:
        engine.dispose()


def sync_table_to_warehouse(
    db_type: str,
    host: Optional[str],
    port: Optional[int],
    database_name: str,
    username: Optional[str],
    password: Optional[str],
    remote_table: str,
    target_table: Optional[str],
    limit_rows: Optional[int],
    warehouse_db: Session,
    ssl_mode: Optional[str] = "prefer"
) -> Dict[str, Any]:
    """
    Pulls data from remote database, cleans it with DataForge AI pipeline,
    and ingests directly into local SQLite warehouse.
    """
    url = build_connection_url(db_type, host, port, database_name, username, password, ssl_mode)
    engine = create_engine(url, connect_args={"connect_timeout": 12} if "sqlite" not in url else {})

    dest_table = clean_column_name(target_table or remote_table)

    try:
        # Build query
        q_limit = f"LIMIT {int(limit_rows)}" if limit_rows and limit_rows > 0 else "LIMIT 50000"
        if "mysql" in url:
            query = f"SELECT * FROM `{remote_table}` {q_limit}"
        else:
            query = f'SELECT * FROM "{remote_table}" {q_limit}'

        df = pd.read_sql_query(query, con=engine)
        if df.empty:
            raise ValueError(f"Remote table '{remote_table}' has 0 rows.")

        # Clean with DataForge Vectorized Pipeline
        cleaned_df, cleaning_summary, schema_info = clean_dataframe(
            df=df,
            drop_duplicates=True,
            fill_nulls=True,
            numeric_strategy="median",
            categorical_strategy="mode",
            standardize_columns=True,
            standardize_dates=True
        )

        # Save to warehouse
        metadata = save_dataframe_to_warehouse(
            db=warehouse_db,
            table_name=dest_table,
            original_filename=f"{db_type.upper()}: {database_name}.{remote_table}",
            df=cleaned_df,
            cleaning_summary=cleaning_summary,
            schema_info=schema_info
        )

        star_relationships = detect_star_schema_relationships(warehouse_db)

        return {
            "success": True,
            "table_name": metadata.table_name,
            "original_filename": metadata.original_filename,
            "row_count": metadata.row_count,
            "column_count": metadata.column_count,
            "table_type": metadata.table_type,
            "schema_info": schema_info,
            "cleaning_summary": cleaning_summary,
            "star_schema_relationships": star_relationships
        }
    finally:
        engine.dispose()
