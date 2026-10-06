from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from app.core.database import Base

class DatabaseConnection(Base):
    __tablename__ = "database_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, default=1)
    name = Column(String(120), nullable=False)
    db_type = Column(String(40), nullable=False)  # 'postgresql', 'mysql', 'sqlite'
    host = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    database_name = Column(String(120), nullable=False)
    username = Column(String(120), nullable=True)
    password = Column(String(255), nullable=True)
    ssl_mode = Column(String(30), default="prefer")
    sync_interval = Column(String(40), default="manual")  # 'manual', 'hourly', 'daily_2am', 'every_6h'
    last_synced_at = Column(DateTime, nullable=True)
    status = Column(String(40), default="CONNECTED")      # 'CONNECTED', 'DISCONNECTED', 'ERROR'
    created_at = Column(DateTime, default=datetime.utcnow)
