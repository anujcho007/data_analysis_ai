from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.copilot_engine import (
    process_copilot_query,
    execute_safe_sql,
    extract_warehouse_schema_summary
)
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
def get_suggested_prompts(db: Session = Depends(get_db)):
    """Returns dynamic starter prompts tailored to the currently ingested tables."""
    datasets = db.query(DatasetMetadata).all()
    if not datasets:
        return [
            "What can you do?",
            "How do I upload data to the warehouse?",
            "What connectors are supported?"
        ]
        
    prompts = [
        f"Give me an executive summary of table '{datasets[0].table_name}'",
        f"Which records have the highest metrics in '{datasets[0].table_name}'?",
        "Are there any anomalous spikes or revenue drops in our warehouse?",
        "Show me the distribution of categories in our fact tables",
        "Forecast performance for the next 30 days"
    ]
    return prompts
