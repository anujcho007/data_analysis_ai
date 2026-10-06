import os
import re
import shutil
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.config import UPLOAD_DIR
from app.services.cleaner import (
    read_csv_from_path,
    clean_dataframe,
    clean_column_name,
    stream_clean_large_csv_to_warehouse
)
from app.services.schema_builder import (
    save_dataframe_to_warehouse,
    detect_star_schema_relationships,
    drop_all_warehouse_tables
)

router = APIRouter(prefix="/api/upload", tags=["CSV Upload & Ingestion"])

RESERVED_TABLES = {
    "users", "dataset_metadata", "sqlite_sequence", "sqlite_master", "sqlite_temp_master",
    "alert_rules", "alert_history", "workspaces", "workspace_members", "database_connections"
}

def sanitize_table_name(filename: str) -> str:
    """Extract and sanitize filename into a clean SQL table name."""
    base_name = os.path.splitext(filename)[0]
    clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', base_name)
    clean_name = re.sub(r'_+', '_', clean_name).strip('_').lower()
    if not clean_name or clean_name[0].isdigit():
        clean_name = f"tbl_{clean_name}"
    if clean_name in RESERVED_TABLES:
        clean_name = f"data_{clean_name}"
    return clean_name

def process_single_csv(
    file_info: Tuple[str, Path],
    drop_duplicates: bool,
    fill_nulls: bool,
    numeric_strategy: str,
    categorical_strategy: str,
    standardize_columns: bool,
    standardize_dates: bool
) -> Optional[Dict[str, Any]]:
    """
    Worker function executed in parallel across CPU worker threads:
    Reads and thoroughly cleans a CSV file without blocking other files.
    """
    filename, raw_path = file_info
    try:
        df = read_csv_from_path(raw_path)
    except Exception as e:
        raise ValueError(f"Could not read CSV '{filename}': {str(e)}")

    if df.empty:
        return None

    cleaned_df, cleaning_summary, schema_info = clean_dataframe(
        df=df,
        drop_duplicates=drop_duplicates,
        fill_nulls=fill_nulls,
        numeric_strategy=numeric_strategy,
        categorical_strategy=categorical_strategy,
        standardize_columns=standardize_columns,
        standardize_dates=standardize_dates
    )

    table_name = sanitize_table_name(filename)

    return {
        "table_name": table_name,
        "original_filename": filename,
        "df": cleaned_df,
        "cleaning_summary": cleaning_summary,
        "schema_info": schema_info
    }

@router.post("/csv")
async def upload_multiple_csv(
    files: List[UploadFile] = File(...),
    clear_existing: bool = Form(True),
    drop_duplicates: bool = Form(True),
    fill_nulls: bool = Form(True),
    numeric_strategy: str = Form("median"),
    categorical_strategy: str = Form("mode"),
    standardize_columns: bool = Form(True),
    standardize_dates: bool = Form(True),
    db: Session = Depends(get_db)
):
    """
    High-Performance Parallel Multi-CSV Ingestion Pipeline:
    1. Parallel Disk Streaming: Streams all uploaded CSV files to disk concurrently
    2. Parallel Data Cleaning: Uses a multi-threaded CPU worker pool to clean DataFrames in parallel
    3. Thread-Safe DB Ingestion: Saves cleaned tables sequentially to warehouse without database locks
    4. Fast Star Schema Detection: Derives relationships in milliseconds
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided for upload."
        )

    # 1. Asynchronously stream uploaded files directly to disk without blocking event loop
    async def save_one_file(file: UploadFile) -> Tuple[str, Path]:
        filename = file.filename or "dataset.csv"
        raw_path = UPLOAD_DIR / filename
        try:
            await file.seek(0)
        except Exception:
            pass
        with open(raw_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
        return filename, raw_path

    file_infos = await asyncio.gather(*[save_one_file(f) for f in files])

    # 2. Parallel CPU data cleaning in worker threads using asyncio.to_thread
    try:
        tasks = [
            asyncio.to_thread(
                process_single_csv,
                f_info,
                drop_duplicates,
                fill_nulls,
                numeric_strategy,
                categorical_strategy,
                standardize_columns,
                standardize_dates
            )
            for f_info in file_infos
        ]
        cleaned_items = await asyncio.gather(*tasks)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

    # 3. Synchronized database ingestion executed in worker thread (keeps event loop free and responsive)
    def _ingest_to_db():
        from app.core.database import SessionLocal
        with SessionLocal() as db_session:
            if clear_existing:
                drop_all_warehouse_tables(db_session)
                db_session.commit()

            results = []
            total_initial_rows = 0
            total_final_rows = 0
            total_duplicates_removed = 0
            total_nulls_filled = 0

            for item in cleaned_items:
                if not item:
                    continue

                metadata = save_dataframe_to_warehouse(
                    db=db_session,
                    table_name=item["table_name"],
                    original_filename=item["original_filename"],
                    df=item["df"],
                    cleaning_summary=item["cleaning_summary"],
                    schema_info=item["schema_info"]
                )

                total_initial_rows += item["cleaning_summary"]["initial_rows"]
                total_final_rows += item["cleaning_summary"]["final_rows"]
                total_duplicates_removed += item["cleaning_summary"]["duplicates_removed"]
                total_nulls_filled += item["cleaning_summary"]["null_values_filled"]

                results.append({
                    "table_name": metadata.table_name,
                    "original_filename": metadata.original_filename,
                    "row_count": metadata.row_count,
                    "column_count": metadata.column_count,
                    "table_type": metadata.table_type,
                    "schema_info": item["schema_info"],
                    "cleaning_summary": item["cleaning_summary"]
                })

            star_relationships = detect_star_schema_relationships(db_session)
            return results, total_initial_rows, total_final_rows, total_duplicates_removed, total_nulls_filled, star_relationships

    results, total_initial_rows, total_final_rows, total_duplicates_removed, total_nulls_filled, star_relationships = await asyncio.to_thread(_ingest_to_db)

    return {
        "success": True,
        "processed_files_count": len(results),
        "overall_summary": {
            "total_initial_rows": total_initial_rows,
            "total_final_rows": total_final_rows,
            "total_duplicates_removed": total_duplicates_removed,
            "total_nulls_filled": total_nulls_filled
        },
        "datasets": results,
        "star_schema_relationships": star_relationships
    }


class ChunkCompleteRequest(BaseModel):
    upload_id: str
    filename: str
    clear_existing: bool = False
    drop_duplicates: bool = True
    fill_nulls: bool = True
    numeric_strategy: str = "median"
    categorical_strategy: str = "mode"
    standardize_columns: bool = True
    standardize_dates: bool = True


@router.post("/chunk")
async def upload_file_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    filename: str = Form(...),
    chunk: UploadFile = File(...)
):
    """
    Receives and writes an individual binary chunk (e.g. 20MB) to disk.
    Allows arbitrary multi-gigabyte files to be uploaded with zero memory pressure.
    """
    chunk_dir = UPLOAD_DIR / "chunks" / upload_id
    chunk_dir.mkdir(parents=True, exist_ok=True)
    part_path = chunk_dir / f"part_{chunk_index:05d}"

    try:
        await chunk.seek(0)
    except Exception:
        pass

    with open(part_path, "wb") as buffer:
        while data := await chunk.read(1024 * 1024):
            buffer.write(data)

    return {
        "status": "success",
        "upload_id": upload_id,
        "chunk_index": chunk_index,
        "total_chunks": total_chunks,
        "filename": filename
    }


@router.post("/chunk/complete")
async def complete_chunk_upload(
    req: ChunkCompleteRequest
):
    """
    Assembles all uploaded chunks in sorted order, stream-cleans the assembled file
    directly into SQLite warehouse, and detects Star Schema relationships.
    """
    chunk_dir = UPLOAD_DIR / "chunks" / req.upload_id
    if not chunk_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload session '{req.upload_id}' not found."
        )

    part_files = sorted(list(chunk_dir.glob("part_*")))
    if not part_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No chunk parts found for session '{req.upload_id}'."
        )

    # 1. Stream-concatenate all binary chunks into the final destination CSV file
    final_path = UPLOAD_DIR / req.filename
    with open(final_path, "wb") as outfile:
        for part in part_files:
            with open(part, "rb") as infile:
                shutil.copyfileobj(infile, outfile, length=4 * 1024 * 1024)

    # 2. Cleanup chunk parts directory to immediately reclaim disk space
    shutil.rmtree(chunk_dir, ignore_errors=True)

    table_name = sanitize_table_name(req.filename)

    # 3. Stream-clean and ingest directly into warehouse using worker thread
    def _run_stream_ingestion():
        from app.core.database import SessionLocal, engine
        if req.clear_existing:
            with SessionLocal() as db_session:
                drop_all_warehouse_tables(db_session)
                db_session.commit()
            engine.dispose()

        metadata, cleaning_summary, schema_info = stream_clean_large_csv_to_warehouse(
            file_path=final_path,
            table_name=table_name,
            original_filename=req.filename,
            db=None,
            drop_duplicates=req.drop_duplicates,
            fill_nulls=req.fill_nulls,
            numeric_strategy=req.numeric_strategy,
            categorical_strategy=req.categorical_strategy,
            standardize_columns=req.standardize_columns,
            standardize_dates=req.standardize_dates,
            chunk_rows=150_000
        )

        with SessionLocal() as db_session:
            star_relationships = detect_star_schema_relationships(db_session)

        meta_data = {
            "table_name": str(metadata.table_name),
            "original_filename": str(metadata.original_filename),
            "row_count": int(metadata.row_count),
            "column_count": int(metadata.column_count),
            "table_type": str(metadata.table_type)
        }
        return meta_data, cleaning_summary, schema_info, star_relationships

    try:
        meta_data, cleaning_summary, schema_info, star_relationships = await asyncio.to_thread(_run_stream_ingestion)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Streaming ingestion error: {str(e)}"
        )

    dataset_result = {
        "table_name": meta_data["table_name"],
        "original_filename": meta_data["original_filename"],
        "row_count": meta_data["row_count"],
        "column_count": meta_data["column_count"],
        "table_type": meta_data["table_type"],
        "schema_info": schema_info,
        "cleaning_summary": cleaning_summary
    }

    return {
        "success": True,
        "table_name": meta_data["table_name"],
        "original_filename": meta_data["original_filename"],
        "row_count": meta_data["row_count"],
        "column_count": meta_data["column_count"],
        "table_type": meta_data["table_type"],
        "schema_info": schema_info,
        "cleaning_summary": cleaning_summary,
        "star_schema_relationships": star_relationships,
        "datasets": [dataset_result],
        "processed_files_count": 1,
        "overall_summary": {
            "total_initial_rows": cleaning_summary["initial_rows"],
            "total_final_rows": cleaning_summary["final_rows"],
            "total_duplicates_removed": cleaning_summary["duplicates_removed"],
            "total_nulls_filled": cleaning_summary["null_values_filled"]
        }
    }


class FetchAPIRequest(BaseModel):
    url: str
    api_key: Optional[str] = None
    header_name: Optional[str] = "Authorization"
    auth_scheme: Optional[str] = "Bearer"  # "Bearer" | "ApiKey" | "Custom"
    table_name: Optional[str] = None
    clear_existing: bool = False
    drop_duplicates: bool = True
    fill_nulls: bool = True
    numeric_strategy: str = "median"
    categorical_strategy: str = "mode"
    standardize_columns: bool = True
    standardize_dates: bool = True


@router.post("/fetch-api")
async def fetch_data_from_api(
    req: FetchAPIRequest,
    db: Session = Depends(get_db)
):
    """
    Fetches raw JSON or CSV data from any external REST API using configured
    authentication headers or public access, cleans and standardizes the schema,
    stores the relational table in the local warehouse, and detects Star Schema links.
    """
    if not req.url or not req.url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API URL endpoint is required."
        )

    from app.services.api_fetcher import fetch_and_ingest_api_data
    try:
        dataset_result, cleaning_summary, schema_info, star_relationships = await fetch_and_ingest_api_data(
            url=req.url.strip(),
            api_key=req.api_key,
            header_name=req.header_name,
            auth_scheme=req.auth_scheme,
            table_name=req.table_name,
            clear_existing=req.clear_existing,
            drop_duplicates=req.drop_duplicates,
            fill_nulls=req.fill_nulls,
            numeric_strategy=req.numeric_strategy,
            categorical_strategy=req.categorical_strategy,
            standardize_columns=req.standardize_columns,
            standardize_dates=req.standardize_dates,
            db=db
        )

        return {
            "success": True,
            "table_name": dataset_result["table_name"],
            "original_filename": dataset_result["original_filename"],
            "row_count": dataset_result["row_count"],
            "column_count": dataset_result["column_count"],
            "table_type": dataset_result["table_type"],
            "schema_info": schema_info,
            "cleaning_summary": cleaning_summary,
            "star_schema_relationships": star_relationships,
            "datasets": [dataset_result],
            "processed_files_count": 1,
            "overall_summary": {
                "total_initial_rows": cleaning_summary["initial_rows"],
                "total_final_rows": cleaning_summary["final_rows"],
                "total_duplicates_removed": cleaning_summary["duplicates_removed"],
                "total_nulls_filled": cleaning_summary["null_values_filled"]
            }
        }
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API Data Ingestion failed: {str(e)}"
        )

