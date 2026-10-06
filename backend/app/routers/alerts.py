from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
import pandas as pd

from app.core.database import get_db
from app.models.alert import AlertRule, AlertHistory
from app.services.anomaly_detector import scan_table_anomalies
from app.services.alert_dispatcher import dispatch_slack_alert, dispatch_generic_webhook

router = APIRouter(prefix="/api/alerts", tags=["Watchdog & Anomaly Alerts"])

class CreateRuleRequest(BaseModel):
    name: str
    table_name: str
    metric_column: str
    condition: str = "drop_pct"
    threshold_value: float = 20.0
    channel: str = "slack"
    target_url: Optional[str] = None
    is_active: bool = True

class TestAlertRequest(BaseModel):
    table_name: str
    metric_name: str
    channel: str = "slack"
    target_url: str
    severity: str = "WARNING"
    message: Optional[str] = "Manual test alert from DataForge AI Watchdog"

@router.get("/scan/{table_name}")
def scan_table_for_anomalies(
    table_name: str,
    metric_column: Optional[str] = None,
    date_column: Optional[str] = None,
    z_threshold: float = 2.5,
    db: Session = Depends(get_db)
):
    """
    Executes live statistical anomaly detection scan across dataset.
    """
    try:
        query = f'SELECT * FROM "{table_name}"'
        df = pd.read_sql_query(query, con=db.connection())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' could not be queried: {str(e)}"
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Table contains no records."
        )

    scan_result = scan_table_anomalies(
        df=df,
        table_name=table_name,
        metric_column=metric_column,
        date_column=date_column,
        z_threshold=z_threshold
    )
    return scan_result


@router.get("/rules")
def get_alert_rules(db: Session = Depends(get_db)):
    """Fetch all active watchdog alert rules."""
    rules = db.query(AlertRule).order_by(desc(AlertRule.created_at)).all()
    return rules


@router.post("/rules", status_code=status.HTTP_201_CREATED)
def create_alert_rule(req: CreateRuleRequest, db: Session = Depends(get_db)):
    """Create a new anomaly watchdog alert rule."""
    new_rule = AlertRule(
        name=req.name,
        table_name=req.table_name,
        metric_column=req.metric_column,
        condition=req.condition,
        threshold_value=req.threshold_value,
        channel=req.channel,
        target_url=req.target_url,
        is_active=req.is_active,
        created_at=datetime.utcnow()
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return new_rule


@router.delete("/rules/{rule_id}")
def delete_alert_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete an alert rule by ID."""
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")
    db.delete(rule)
    db.commit()
    return {"success": True, "message": "Alert rule deleted."}


@router.post("/test-dispatch")
async def test_alert_dispatch(req: TestAlertRequest, db: Session = Depends(get_db)):
    """Send an instant test notification to the configured webhook."""
    if not req.target_url or not req.target_url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid webhook URL is required."
        )

    test_msg = req.message or f"Test anomaly trigger for metric '{req.metric_name}' on table '{req.table_name}'."
    dispatch_res = await dispatch_slack_alert(
        webhook_url=req.target_url.strip(),
        table_name=req.table_name,
        metric_name=req.metric_name,
        severity=req.severity,
        triggered_value=42.50,
        expected_value=120.00,
        message=test_msg
    )

    # Log to incident history
    incident = AlertHistory(
        table_name=req.table_name,
        metric_name=req.metric_name,
        severity=req.severity,
        triggered_value=42.50,
        expected_value=120.00,
        message=test_msg,
        status="DELIVERED" if dispatch_res.get("success") else "FAILED",
        created_at=datetime.utcnow()
    )
    db.add(incident)
    db.commit()

    return {
        "success": dispatch_res.get("success", False),
        "status": dispatch_res.get("status", "UNKNOWN"),
        "detail": dispatch_res
    }


@router.get("/history")
def get_alert_history(limit: int = 50, db: Session = Depends(get_db)):
    """Fetch recent incident logs and dispatch history."""
    history = db.query(AlertHistory).order_by(desc(AlertHistory.created_at)).limit(limit).all()
    return history
