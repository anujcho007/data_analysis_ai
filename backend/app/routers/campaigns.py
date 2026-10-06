from typing import Optional, Dict, Any
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
    detect_marketing_columns
)

router = APIRouter(prefix="/api/campaigns", tags=["Marketing & Campaign Studio"])

class CampaignAnalyticsRequest(BaseModel):
    table_name: Optional[str] = None
    channel: Optional[str] = "All"
    campaign: Optional[str] = "All"
    start_date: Optional[str] = None
    end_date: Optional[str] = None

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
    col_mapping = None

    if req.table_name and req.table_name != "benchmark_demo":
        try:
            # Query custom table from warehouse
            df = pd.read_sql(f"SELECT * FROM \"{req.table_name}\"", con=engine)
            if df.empty:
                raise ValueError("Selected table is empty.")
            col_mapping = detect_marketing_columns(df)
        except Exception as e:
            # Fallback to default demo if error loading custom table
            df = generate_default_marketing_data()
            col_mapping = None
    else:
        # Use default benchmark dataset
        df = generate_default_marketing_data()
        col_mapping = None

    analytics = compute_campaign_analytics(
        df=df,
        col_mapping=col_mapping,
        channel_filter=req.channel,
        campaign_filter=req.campaign,
        start_date=req.start_date,
        end_date=req.end_date
    )

    return analytics
