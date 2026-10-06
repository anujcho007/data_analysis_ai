import os
import sys
from pathlib import Path
import pytest
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.core.database import Base

@pytest.fixture
def in_memory_db():
    """Provides a fresh isolated in-memory SQLite database session for unit tests."""
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def sample_dirty_dataframe():
    """Provides a sample DataFrame with duplicate rows, dirty tokens, and missing values."""
    data = {
        "Order ID": ["ORD-001", "ORD-002", "ORD-002", "ORD-003", "ORD-004", "ORD-005"],
        "Customer Name": ["Alice Smith", "Bob Jones", "Bob Jones", "Charlie Brown", None, "Eva Green"],
        "Price Amount": [100.50, 200.00, 200.00, None, 450.75, "N/A"],
        "Category": ["Electronics", "Books", "Books", None, "Home", "-"],
        "Order Date": ["2026-01-10", "2026-01-11", "2026-01-11", "2026-01-12", "invalid_date", "2026-01-14"]
    }
    return pd.DataFrame(data)
