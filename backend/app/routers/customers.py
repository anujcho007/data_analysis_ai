from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pandas as pd
import re

from app.core.database import get_db
from app.services.customer_intelligence import (
    detect_customer_columns,
    compute_rfm_segmentation,
    compute_cohort_retention
)

router = APIRouter(prefix="/api/customers", tags=["Customer 360 & Growth Studio"])

class RFMRequest(BaseModel):
    table_name: str
    customer_column: Optional[str] = None
    date_column: Optional[str] = None
    monetary_column: Optional[str] = None
    sample_limit: Optional[int] = 100000

class CohortRequest(BaseModel):
    table_name: str
    customer_column: Optional[str] = None
    date_column: Optional[str] = None
    sample_limit: Optional[int] = 100000


@router.get("/candidates/{table_name}")
def get_customer_candidates(table_name: str, db: Session = Depends(get_db)):
    """
    Auto-discovers recommended customer ID, transaction date, and revenue columns.
    """
    sanitized_table = re.sub(r'[^a-zA-Z0-9_]', '', table_name)
    try:
        query = f'SELECT * FROM "{sanitized_table}" LIMIT 1000'
        df = pd.read_sql_query(query, con=db.connection())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' could not be loaded: {str(e)}"
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected table has no data records."
        )

    candidates = detect_customer_columns(df)
    
    # Return available numeric and date columns as selection options
    all_cols = list(df.columns)
    return {
        "table_name": table_name,
        "row_count": len(df),
        "detected": candidates,
        "available_columns": all_cols
    }


@router.post("/rfm")
def run_rfm_analysis(req: RFMRequest, db: Session = Depends(get_db)):
    """
    Executes RFM segmentation analysis and generates behavioral customer profiles.
    """
    sanitized_table = re.sub(r'[^a-zA-Z0-9_]', '', req.table_name)
    try:
        limit_val = min(req.sample_limit or 100000, 250000)
        query = f'SELECT * FROM "{sanitized_table}" LIMIT {limit_val}'
        df = pd.read_sql_query(query, con=db.connection())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{req.table_name}' could not be queried: {str(e)}"
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset contains no transactions."
        )

    # Detect if not explicitly provided
    auto_detect = detect_customer_columns(df)
    c_col = req.customer_column or auto_detect["customer_column"]
    d_col = req.date_column or auto_detect["date_column"]
    m_col = req.monetary_column or auto_detect["monetary_column"]

    if not c_col or c_col not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A valid customer/user ID column is required for RFM segmentation."
        )
    if not d_col or d_col not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A valid purchase date/timestamp column is required for RFM segmentation."
        )
    if not m_col or m_col not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A numeric revenue/spend metric column is required for RFM segmentation."
        )

    try:
        rfm_results = compute_rfm_segmentation(
            df=df,
            customer_col=c_col,
            date_col=d_col,
            monetary_col=m_col
        )
        rfm_results["resolved_columns"] = {
            "customer_column": c_col,
            "date_column": d_col,
            "monetary_column": m_col
        }
        return rfm_results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"RFM analysis computation failed: {str(e)}"
        )


@router.post("/cohorts")
def run_cohort_retention(req: CohortRequest, db: Session = Depends(get_db)):
    """
    Computes monthly cohort retention heatmap matrix.
    """
    sanitized_table = re.sub(r'[^a-zA-Z0-9_]', '', req.table_name)
    try:
        limit_val = min(req.sample_limit or 100000, 250000)
        query = f'SELECT * FROM "{sanitized_table}" LIMIT {limit_val}'
        df = pd.read_sql_query(query, con=db.connection())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{req.table_name}' could not be queried: {str(e)}"
        )

    auto_detect = detect_customer_columns(df)
    c_col = req.customer_column or auto_detect["customer_column"]
    d_col = req.date_column or auto_detect["date_column"]

    if not c_col or not d_col:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both customer ID and transaction date columns are required for cohort retention."
        )

    try:
        cohort_results = compute_cohort_retention(
            df=df,
            customer_col=c_col,
            date_col=d_col
        )
        return cohort_results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cohort retention computation failed: {str(e)}"
        )
