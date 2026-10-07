from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.copilot_engine import (
    process_copilot_query,
    execute_safe_sql,
    extract_warehouse_schema_summary
)
from app.services.prompt_generator import generate_prompts_for_database
from app.models.dataset import DatasetMetadata

router = APIRouter(prefix="/api/copilot", tags=["Conversational AI Copilot"])

class ChatRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = []

class ExecuteSqlRequest(BaseModel):
    sql: str

@router.post("/chat")
def chat_with_copilot(req: ChatRequest, db: Session = Depends(get_db)):
    """Process natural language query against warehouse and return conversational response + SQL data."""
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query cannot be empty.")
        
    try:
        response = process_copilot_query(req.query.strip(), db, req.history)
        return response
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Copilot processing failed: {str(e)}")

@router.post("/execute-sql")
def execute_copilot_sql(req: ExecuteSqlRequest, db: Session = Depends(get_db)):
    """Safely execute custom SELECT SQL generated or edited by the user."""
    if not req.sql or not req.sql.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SQL query required.")
        
    try:
        result = execute_safe_sql(db, req.sql.strip())
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"SQL execution error: {str(e)}")

@router.get("/prompts")
def get_suggested_prompts(
    table_name: Optional[str] = Query(None, description="Optional target table name to focus prompts on"),
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Returns dynamic starter prompts tailored to the currently ingested tables or specified table."""
    return generate_prompts_for_database(db, target_table=table_name, limit=limit)

