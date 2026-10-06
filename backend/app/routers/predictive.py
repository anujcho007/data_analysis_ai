from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import pandas as pd
import numpy as np

from app.core.database import get_db
from app.services.predictive_engine import (
    detect_predictive_columns,
    fit_time_series_forecast,
    diagnose_underperforming_items,
    generate_prescriptive_client_recommendations
)

router = APIRouter(prefix="/api/predictive", tags=["Predictive AI Studio"])

class ForecastRequest(BaseModel):
    table_name: str
    date_column: Optional[str] = None
    metric_column: Optional[str] = None
    item_column: Optional[str] = None
    horizon_periods: int = 30

@router.get("/candidates/{table_name}")
def get_predictive_candidates(table_name: str, db: Session = Depends(get_db)):
    """
    Auto-discovers recommended date, metric, and item columns for predictive analytics.
    """
    # Fetch sample rows from warehouse
    try:
        query = f'SELECT * FROM "{table_name}" LIMIT 500'
        df = pd.read_sql_query(query, con=db.connection())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' not found or inaccessible: {str(e)}"
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table '{table_name}' has 0 rows."
        )

    candidates = detect_predictive_columns(df)
    return {
        "table_name": table_name,
        "row_count": len(df),
        "candidates": candidates
    }


@router.post("/forecast")
def generate_forecast_and_recommendations(req: ForecastRequest, db: Session = Depends(get_db)):
    """
    Executes full predictive data science modeling pipeline:
    1. Loads dataset from warehouse
    2. Auto-detects or validates target columns
    3. Fits time-series trend model with 95% confidence intervals
    4. Diagnoses lagging/low-performing items and computes revenue gap
    5. Generates client prescriptive recommendations
    """
    try:
        query = f'SELECT * FROM "{req.table_name}"'
        df = pd.read_sql_query(query, con=db.connection())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{req.table_name}' could not be queried: {str(e)}"
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected table contains no data records."
        )

    # 1. Resolve Columns
    detected = detect_predictive_columns(df)
    
    date_col = req.date_column or detected["recommended_date"]
    metric_col = req.metric_column or detected["recommended_metric"]
    item_col = req.item_column or detected["recommended_item"]

    if not metric_col:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No numeric metric column (e.g. sales, price, amount, quantity) found in this table."
        )

    # 2. Prepare Time-Series Data Points
    df[metric_col] = pd.to_numeric(df[metric_col], errors='coerce').fillna(0)

    dates_list = []
    values_list = []

    if date_col and date_col in df.columns:
        df_ts = df[[date_col, metric_col]].copy()
        df_ts[date_col] = pd.to_datetime(df_ts[date_col], errors='coerce')
        df_ts = df_ts.dropna(subset=[date_col])
        if len(df_ts) >= 3:
            # Group by day / date
            daily_agg = df_ts.groupby(df_ts[date_col].dt.strftime('%Y-%m-%d'))[metric_col].sum().reset_index()
            daily_agg = daily_agg.sort_values(by=date_col).reset_index(drop=True)
            dates_list = daily_agg[date_col].tolist()
            values_list = daily_agg[metric_col].tolist()

    # Fallback to sequential row ordering if no valid date column or too few date points
    if len(dates_list) < 3:
        # Aggregate in buckets or use direct sequence
        total_rows = len(df)
        step = max(1, total_rows // 50)
        sliced = df.iloc[::step]
        dates_list = [f"Period {i+1}" for i in range(len(sliced))]
        values_list = sliced[metric_col].tolist()

    # 3. Fit Time Series Forecasting Model
    horizon = max(7, min(180, req.horizon_periods))
    forecast_results = fit_time_series_forecast(
        dates=dates_list,
        values=values_list,
        horizon_periods=horizon
    )

    # 4. Item Diagnostic (if item column exists or can be detected)
    low_performers = []
    top_performers = []
    item_summary = {}

    if not item_col and detected["candidate_items"]:
        item_col = detected["candidate_items"][0]

    if item_col and item_col in df.columns:
        low_performers, top_performers, item_summary = diagnose_underperforming_items(
            df=df,
            item_col=item_col,
            metric_col=metric_col,
            date_col=date_col
        )

    # 5. Formulate Prescriptive Client Recommendations
    recommendations = generate_prescriptive_client_recommendations(
        table_name=req.table_name,
        metric_col=metric_col,
        item_col=item_col or "Items",
        growth_rate_pct=forecast_results["growth_rate_pct"],
        low_performers=low_performers,
        top_performers=top_performers
    )

    return {
        "table_name": req.table_name,
        "selected_columns": {
            "date_column": date_col,
            "metric_column": metric_col,
            "item_column": item_col
        },
        "available_columns": detected,
        "forecast_horizon": horizon,
        "model_summary": {
            "model_type": forecast_results["model_type"],
            "r2_score": forecast_results["r2_score"],
            "mape": forecast_results["mape"],
            "growth_rate_pct": forecast_results["growth_rate_pct"],
            "trend_direction": forecast_results["trend_direction"],
            "momentum": forecast_results["momentum"],
            "historical_points_count": len(forecast_results["historical"]),
            "projected_points_count": len(forecast_results["forecast"])
        },
        "historical_data": forecast_results["historical"],
        "forecast_data": forecast_results["forecast"],
        "underperforming_items": low_performers,
        "top_performing_items": top_performers,
        "item_diagnostic_summary": item_summary,
        "client_recommendations": recommendations
    }


from app.services.simulator_engine import run_digital_twin_simulation

class SimulationRequest(BaseModel):
    table_name: str
    metric_column: str
    date_column: Optional[str] = None
    price_change_pct: float = 0.0
    price_elasticity: float = -1.2
    marketing_multiplier: float = 1.0
    cost_inflation_pct: float = 0.0
    churn_rate_pct: float = 0.0
    horizon_days: int = 60
    mc_iterations: int = 100

@router.post("/simulate")
def simulate_business_scenarios(req: SimulationRequest, db: Session = Depends(get_db)):
    """
    Executes Digital Twin Monte Carlo business scenario simulation across stochastic economic paths.
    """
    try:
        results = run_digital_twin_simulation(
            db=db,
            table_name=req.table_name,
            metric_column=req.metric_column,
            date_column=req.date_column,
            price_change_pct=req.price_change_pct,
            price_elasticity=req.price_elasticity,
            marketing_multiplier=req.marketing_multiplier,
            cost_inflation_pct=req.cost_inflation_pct,
            churn_rate_pct=req.churn_rate_pct,
            horizon_days=req.horizon_days,
            mc_iterations=req.mc_iterations
        )
        return results
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Simulation failed: {str(e)}")

