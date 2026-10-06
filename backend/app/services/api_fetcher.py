import re
import json
import time
import io
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import httpx
from sqlalchemy.orm import Session
from app.models.dataset import DatasetMetadata
from app.services.cleaner import clean_dataframe, clean_column_name
from app.services.schema_builder import (
    save_dataframe_to_warehouse,
    detect_star_schema_relationships,
    drop_all_warehouse_tables
)

RESERVED_TABLES = {"users", "dataset_metadata", "sqlite_sequence", "sqlite_master", "sqlite_temp_master"}

def sanitize_api_table_name(table_name: Optional[str], url: str) -> str:
    """Generate a clean, SQL-safe table name from custom name or URL path."""
    if table_name and table_name.strip():
        raw_name = table_name.strip()
    else:
        # Derive from URL path
        parsed = urllib.parse.urlparse(url)
        path_parts = [p for p in parsed.path.split('/') if p and not p.isdigit()]
        if path_parts:
            raw_name = path_parts[-1]
            if len(path_parts) > 1 and len(raw_name) < 4:
                raw_name = f"{path_parts[-2]}_{raw_name}"
        else:
            host_clean = parsed.netloc.split('.')[0]
            raw_name = f"api_{host_clean}"

    # Clean name
    clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', raw_name)
    clean_name = re.sub(r'_+', '_', clean_name).strip('_').lower()
    if not clean_name or clean_name[0].isdigit():
        clean_name = f"api_{clean_name}"
    if clean_name in RESERVED_TABLES:
        clean_name = f"data_{clean_name}"
    return clean_name

def extract_tabular_data_from_json(json_data: Any) -> pd.DataFrame:
    """
    Intelligently extracts and flattens tabular records from any arbitrary JSON structure:
    - Root list: [ {...}, {...} ]
    - Common wrapper keys: { "data": [...], "results": [...], "items": [...] }
    - Nested dict records (flattens nested objects into snake_case columns)
    """
    if isinstance(json_data, list):
        if not json_data:
            raise ValueError("The API returned an empty list of records.")
        # If list of primitives (strings, numbers)
        if not isinstance(json_data[0], dict):
            return pd.DataFrame({"value": json_data})
        return pd.json_normalize(json_data)

    if isinstance(json_data, dict):
        # 1. Search common collection keys
        priority_keys = [
            "data", "results", "items", "records", "rows", 
            "users", "products", "orders", "posts", "customers", 
            "elements", "entries", "content", "coins", "list"
        ]
        for key in priority_keys:
            if key in json_data and isinstance(json_data[key], list) and len(json_data[key]) > 0:
                if isinstance(json_data[key][0], dict):
                    return pd.json_normalize(json_data[key])
                return pd.DataFrame({key: json_data[key]})

        # 2. Search for any key that contains a list of dicts
        for key, val in json_data.items():
            if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                return pd.json_normalize(val)

        # 3. Single record dictionary: wrap in list
        return pd.json_normalize([json_data])

    raise ValueError(f"Unsupported API response type: {type(json_data).__name__}")


async def fetch_and_ingest_api_data(
    url: str,
    api_key: Optional[str] = None,
    header_name: Optional[str] = "Authorization",
    auth_scheme: Optional[str] = "Bearer",
    table_name: Optional[str] = None,
    clear_existing: bool = False,
    drop_duplicates: bool = True,
    fill_nulls: bool = True,
    numeric_strategy: str = "median",
    categorical_strategy: str = "mode",
    standardize_columns: bool = True,
    standardize_dates: bool = True,
    db: Session = None
) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Asynchronously fetches data from any external REST API, normalizes arbitrary JSON/CSV structures
    into tabular DataFrames, cleans dirty values, ingests into SQLite warehouse, and detects Star Schema links.
    """
    # 1. Construct HTTP Headers
    headers = {
        "User-Agent": "DataForge-AI-Client/1.0 (Business Intelligence Ingestion Engine)",
        "Accept": "application/json, text/csv, text/plain, */*"
    }

    if api_key and api_key.strip():
        clean_key = api_key.strip()
        h_name = header_name.strip() if header_name and header_name.strip() else "Authorization"

        if auth_scheme == "Bearer" and h_name.lower() == "authorization":
            headers["Authorization"] = f"Bearer {clean_key}"
        elif auth_scheme == "ApiKey" and h_name.lower() == "authorization":
            headers["Authorization"] = clean_key
        else:
            headers[h_name] = clean_key

    # 2. Perform HTTP Request with httpx
    try:
        async with httpx.AsyncClient(timeout=35.0, follow_redirects=True, verify=False) as client:
            resp = await client.get(url, headers=headers)
    except httpx.ConnectTimeout:
        raise ValueError(f"Connection timeout while attempting to reach '{url}'. Please verify the endpoint is online.")
    except httpx.ConnectError as ce:
        raise ValueError(f"Could not connect to '{url}': {str(ce)}")
    except Exception as e:
        raise ValueError(f"Network error fetching API data: {str(e)}")

    if resp.status_code == 401:
        raise ValueError(f"HTTP 401 Unauthorized: The API requires a valid API key or authorization token.")
    if resp.status_code == 403:
        raise ValueError(f"HTTP 403 Forbidden: Access denied by the external API provider. Check permissions or API key.")
    if resp.status_code == 404:
        raise ValueError(f"HTTP 404 Not Found: The specified endpoint '{url}' does not exist.")
    if resp.status_code >= 400:
        raise ValueError(f"API request failed with HTTP status {resp.status_code}: {resp.text[:300]}")

    content_type = resp.headers.get("content-type", "").lower()

    # 3. Parse Data into Pandas DataFrame
    df = None
    if "json" in content_type:
        try:
            data = resp.json()
            df = extract_tabular_data_from_json(data)
        except Exception as e:
            raise ValueError(f"Failed to parse JSON response from API: {str(e)}")
    elif "csv" in content_type or "text/plain" in content_type:
        try:
            df = pd.read_csv(io.StringIO(resp.text), low_memory=False, on_bad_lines='skip')
        except Exception:
            # Fallback try JSON
            try:
                data = resp.json()
                df = extract_tabular_data_from_json(data)
            except Exception as e:
                raise ValueError(f"Could not parse CSV/JSON from API response: {str(e)}")
    else:
        # Generic fallback: try json first, then csv
        try:
            data = resp.json()
            df = extract_tabular_data_from_json(data)
        except Exception:
            try:
                df = pd.read_csv(io.StringIO(resp.text), low_memory=False, on_bad_lines='skip')
            except Exception as e:
                raise ValueError(f"Unsupported content-type '{content_type}' and unable to parse response: {str(e)}")

    if df is None or df.empty:
        raise ValueError("The API endpoint responded with 0 records or empty data.")

    # 4. Safely serialize any nested dict/list objects in DataFrame cells to JSON strings
    for col in list(df.columns):
        col_data = df[col]
        if isinstance(col_data, pd.DataFrame):
            col_data = col_data.iloc[:, 0]
            df[col] = col_data
        try:
            has_nested = col_data.apply(lambda x: isinstance(x, (dict, list))).any()
            if has_nested:
                df[col] = col_data.apply(lambda x: json.dumps(x, ensure_ascii=False) if isinstance(x, (dict, list)) else x)
        except Exception:
            pass

    # 5. Clean with DataForge Vectorized Cleaning Pipeline
    cleaned_df, cleaning_summary, schema_info = clean_dataframe(
        df=df,
        drop_duplicates=drop_duplicates,
        fill_nulls=fill_nulls,
        numeric_strategy=numeric_strategy,
        categorical_strategy=categorical_strategy,
        standardize_columns=standardize_columns,
        standardize_dates=standardize_dates
    )

    clean_tbl_name = sanitize_api_table_name(table_name, url)

    # 6. Save directly into Local SQLite Warehouse
    if clear_existing:
        drop_all_warehouse_tables(db)
        db.commit()

    metadata = save_dataframe_to_warehouse(
        db=db,
        table_name=clean_tbl_name,
        original_filename=f"API: {urllib.parse.urlparse(url).netloc}",
        df=cleaned_df,
        cleaning_summary=cleaning_summary,
        schema_info=schema_info
    )

    star_relationships = detect_star_schema_relationships(db)

    dataset_result = {
        "table_name": metadata.table_name,
        "original_filename": metadata.original_filename,
        "row_count": metadata.row_count,
        "column_count": metadata.column_count,
        "table_type": metadata.table_type,
        "schema_info": schema_info,
        "cleaning_summary": cleaning_summary
    }

    return dataset_result, cleaning_summary, schema_info, star_relationships
