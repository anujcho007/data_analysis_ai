from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.connector import DatabaseConnection
from app.services.db_connector import (
    test_remote_database,
    get_remote_tables_info,
    sync_table_to_warehouse
)

router = APIRouter(prefix="/api/connectors", tags=["Database Connectors & Live Sync"])

class TestConnectionRequest(BaseModel):
    db_type: str
    host: Optional[str] = "localhost"
    port: Optional[int] = None
    database_name: str
    username: Optional[str] = None
    password: Optional[str] = None
    ssl_mode: Optional[str] = "prefer"

class SaveConnectionRequest(TestConnectionRequest):
    name: str
    workspace_id: Optional[int] = 1
    sync_interval: Optional[str] = "manual"

class SyncTableRequest(BaseModel):
    connection_id: Optional[int] = None
    # Or ad-hoc connection params
    db_type: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssl_mode: Optional[str] = "prefer"
    # Target table info
    remote_table: str
    target_table: Optional[str] = None
    limit_rows: Optional[int] = 10000

@router.get("")
def list_connections(workspace_id: Optional[int] = 1, db: Session = Depends(get_db)):
    """List saved database connections in the current workspace."""
    conns = db.query(DatabaseConnection).filter(
        (DatabaseConnection.workspace_id == workspace_id) | (DatabaseConnection.workspace_id == None)
    ).order_by(DatabaseConnection.created_at.desc()).all()
    
    results = []
    for c in conns:
        results.append({
            "id": c.id,
            "name": c.name,
            "db_type": c.db_type,
            "host": c.host,
            "port": c.port,
            "database_name": c.database_name,
            "username": c.username,
            "ssl_mode": c.ssl_mode,
            "sync_interval": c.sync_interval,
            "last_synced_at": c.last_synced_at,
            "status": c.status,
            "created_at": c.created_at
        })
    return results

@router.post("/test")
def test_connection_params(req: TestConnectionRequest):
    """Test remote database connectivity, measure latency, and inspect server version."""
    result = test_remote_database(
        db_type=req.db_type,
        host=req.host,
        port=req.port,
        database_name=req.database_name,
        username=req.username,
        password=req.password,
        ssl_mode=req.ssl_mode
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection failed ({result.get('latency_ms')}ms): {result.get('error')}"
        )
    return result

@router.post("", status_code=status.HTTP_201_CREATED)
def save_connection(req: SaveConnectionRequest, db: Session = Depends(get_db)):
    """Save a verified database connection for live sync."""
    # Test first
    test_res = test_remote_database(
        db_type=req.db_type,
        host=req.host,
        port=req.port,
        database_name=req.database_name,
        username=req.username,
        password=req.password,
        ssl_mode=req.ssl_mode
    )
    conn_status = "CONNECTED" if test_res.get("success") else "ERROR"

    new_conn = DatabaseConnection(
        workspace_id=req.workspace_id or 1,
        name=req.name,
        db_type=req.db_type,
        host=req.host,
        port=req.port,
        database_name=req.database_name,
        username=req.username,
        password=req.password,
        ssl_mode=req.ssl_mode,
        sync_interval=req.sync_interval or "manual",
        status=conn_status,
        created_at=datetime.utcnow()
    )
    db.add(new_conn)
    db.commit()
    db.refresh(new_conn)

    return {
        "id": new_conn.id,
        "name": new_conn.name,
        "db_type": new_conn.db_type,
        "database_name": new_conn.database_name,
        "status": new_conn.status,
        "latency_ms": test_res.get("latency_ms")
    }

@router.delete("/{connection_id}")
def delete_connection(connection_id: int, db: Session = Depends(get_db)):
    """Delete a saved database connection."""
    conn_record = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not conn_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found.")
    db.delete(conn_record)
    db.commit()
    return {"success": True, "message": "Connection deleted."}

@router.post("/tables")
def inspect_remote_tables(req: TestConnectionRequest):
    """Lists remote tables, row counts, and column definitions."""
    try:
        tables_list = get_remote_tables_info(
            db_type=req.db_type,
            host=req.host,
            port=req.port,
            database_name=req.database_name,
            username=req.username,
            password=req.password,
            ssl_mode=req.ssl_mode
        )
        return {"tables": tables_list, "total_tables": len(tables_list)}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{connection_id}/tables")
def inspect_saved_connection_tables(connection_id: int, db: Session = Depends(get_db)):
    """Lists remote tables using saved connection credentials."""
    conn = db.query(DatabaseConnection).filter(DatabaseConnection.id == connection_id).first()
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found.")
    try:
        tables_list = get_remote_tables_info(
            db_type=conn.db_type,
            host=conn.host,
            port=conn.port,
            database_name=conn.database_name,
            username=conn.username,
            password=conn.password,
            ssl_mode=conn.ssl_mode
        )
        return {"tables": tables_list, "total_tables": len(tables_list)}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/sync")
def sync_table(req: SyncTableRequest, db: Session = Depends(get_db)):
    """
    Synchronizes a selected remote table into the local DataForge SQLite warehouse.
    Cleans data, imputes missing values, and classifies Fact vs Dimension roles.
    """
    # Resolve connection details
    if req.connection_id:
        conn_record = db.query(DatabaseConnection).filter(DatabaseConnection.id == req.connection_id).first()
        if not conn_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection ID not found.")
        db_type = conn_record.db_type
        host = conn_record.host
        port = conn_record.port
        database_name = conn_record.database_name
        username = conn_record.username
        password = conn_record.password
        ssl_mode = conn_record.ssl_mode
    else:
        db_type = req.db_type
        host = req.host
        port = req.port
        database_name = req.database_name
        username = req.username
        password = req.password
        ssl_mode = req.ssl_mode

    if not db_type or not database_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Database parameters or connection_id required.")

    try:
        res = sync_table_to_warehouse(
            db_type=db_type,
            host=host,
            port=port,
            database_name=database_name,
            username=username,
            password=password,
            remote_table=req.remote_table,
            target_table=req.target_table,
            limit_rows=req.limit_rows or 10000,
            warehouse_db=db,
            ssl_mode=ssl_mode
        )

        # Update last synced at if saved connection
        if req.connection_id:
            conn_record.last_synced_at = datetime.utcnow()
            conn_record.status = "CONNECTED"
            db.commit()

        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database synchronization failed: {str(e)}"
        )
