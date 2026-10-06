from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from app.core.database import Base

class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    table_name = Column(String(100), nullable=False, index=True)
    metric_column = Column(String(100), nullable=False)
    condition = Column(String(50), nullable=False, default="drop_pct")  # 'drop_pct', 'spike_pct', 'z_score', 'threshold_below'
    threshold_value = Column(Float, nullable=False, default=20.0)
    channel = Column(String(50), nullable=False, default="slack")       # 'slack', 'webhook', 'email'
    target_url = Column(String(500), nullable=True)                     # Webhook URL or Email address
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AlertHistory(Base):
    __tablename__ = "alert_history"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id", ondelete="SET NULL"), nullable=True)
    table_name = Column(String(100), nullable=False, index=True)
    metric_name = Column(String(100), nullable=False)
    severity = Column(String(30), nullable=False, default="WARNING")   # 'CRITICAL', 'WARNING', 'INFO'
    triggered_value = Column(Float, nullable=False)
    expected_value = Column(Float, nullable=True)
    message = Column(Text, nullable=False)
    status = Column(String(50), default="DELIVERED")                   # 'DELIVERED', 'FAILED', 'SIMULATED'
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
