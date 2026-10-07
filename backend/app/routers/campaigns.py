from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import pandas as pd
from app.core.database import engine
from app.core.security import get_current_user
from app.models.user import User
from app.services.campaign_intelligence import (
    find_marketing_candidate_tables,
    generate_default_marketing_data,
    compute_campaign_analytics,
    detect_marketing_columns,
    RESERVED_TABLES
)

router = APIRouter(prefix="/api/campaigns", tags=["Marketing & Campaign Studio"])

class CampaignAnalyticsRequest(BaseModel):
    table_name: Optional[str] = None
    channel: Optional[str] = "All"
    campaign: Optional[str] = "All"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    col_mapping: Optional[Dict[str, Optional[str]]] = None

@router.get("/candidates")
def get_campaign_candidates(current_user: User = Depends(get_current_user)):
    """
    Returns candidate warehouse tables with campaign/marketing attributes,
    plus the built-in demo marketing campaign benchmark dataset.
    """
    candidates = find_marketing_candidate_tables()
    return {
        "benchmark_dataset_available": True,
        "default_source": "benchmark_demo",
        "warehouse_candidates": candidates
    }

@router.post("/analytics")
def get_campaign_analytics(
    req: CampaignAnalyticsRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Computes all executive KPIs, sparklines, donuts, and timeline curves
    filtered by channel, campaign, and date range.
    """
    df = None
    col_mapping = req.col_mapping
    is_custom = False

    if req.table_name and req.table_name != "benchmark_demo":
        if req.table_name in RESERVED_TABLES:
            raise HTTPException(status_code=403, detail=f"Access to internal system table '{req.table_name}' is forbidden.")

        try:
            # Query custom table with limit to handle 1M+ row datasets smoothly
            df = pd.read_sql(f"SELECT * FROM \"{req.table_name}\" LIMIT 50000", con=engine)
            if df.empty:
                raise HTTPException(status_code=400, detail=f"Table '{req.table_name}' contains no records.")
            
            if not col_mapping:
                col_mapping = detect_marketing_columns(df, req.table_name)
            is_custom = True
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to query table '{req.table_name}': {str(e)}")
    else:
        df = generate_default_marketing_data()
        col_mapping = None

    try:
        analytics = compute_campaign_analytics(
            df=df,
            col_mapping=col_mapping,
            channel_filter=req.channel,
            campaign_filter=req.campaign,
            start_date=req.start_date,
            end_date=req.end_date,
            table_name=req.table_name or "benchmark_demo"
        )
        analytics['is_custom_table'] = is_custom
        analytics['source_table'] = req.table_name or "benchmark_demo"
        return analytics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics computation failed: {str(e)}")
