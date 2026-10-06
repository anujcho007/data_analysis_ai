import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from app.services.customer_intelligence import (
    detect_customer_columns,
    assign_rfm_segment,
    compute_rfm_segmentation,
    compute_cohort_retention
)

@pytest.fixture
def mock_transaction_dataset():
    """Generates synthetic multi-customer transaction data with known behavioral patterns."""
    base_date = datetime(2026, 1, 1)
    records = []

    # 1. Champion Customer: Recent, frequent, high spend
    for i in range(10):
        records.append({
            "user_id": "CUST_CHAMPION",
            "order_date": (base_date + timedelta(days=50 + i)).strftime('%Y-%m-%d'),
            "amount": 250.0
        })

    # 2. At-Risk Customer: Old, frequent, high past spend
    for i in range(8):
        records.append({
            "user_id": "CUST_AT_RISK",
            "order_date": (base_date + timedelta(days=i * 2)).strftime('%Y-%m-%d'),
            "amount": 180.0
        })

    # 3. New Customer: Recent, single order
    records.append({
        "user_id": "CUST_NEWBIE",
        "order_date": (base_date + timedelta(days=59)).strftime('%Y-%m-%d'),
        "amount": 75.0
    })

    # 4. Churned Customer: Old, single small order
    records.append({
        "user_id": "CUST_CHURNED",
        "order_date": (base_date + timedelta(days=2)).strftime('%Y-%m-%d'),
        "amount": 30.0
    })

    # 5. Regular Customer
    for i in range(4):
        records.append({
            "user_id": f"CUST_REGULAR_{i}",
            "order_date": (base_date + timedelta(days=25 + i * 5)).strftime('%Y-%m-%d'),
            "amount": 90.0
        })

    return pd.DataFrame(records)

def test_detect_customer_columns(mock_transaction_dataset):
    detected = detect_customer_columns(mock_transaction_dataset)
    assert detected["customer_column"] == "user_id"
    assert detected["date_column"] == "order_date"
    assert detected["monetary_column"] == "amount"

def test_detect_healthcare_columns():
    health_df = pd.DataFrame([
        {"patient_id": "PAT_101", "admission_date": "2026-01-15", "claim_amount": 4200.50},
        {"patient_id": "PAT_102", "admission_date": "2026-01-18", "claim_amount": 850.00}
    ])
    detected = detect_customer_columns(health_df)
    assert detected["customer_column"] == "patient_id"
    assert detected["date_column"] == "admission_date"
    assert detected["monetary_column"] == "claim_amount"

def test_assign_rfm_segment_logic():
    champ_seg, color, rec = assign_rfm_segment(5, 5, 5)
    assert champ_seg == "Champions"
    assert color == "#10b981"
    assert "VIP" in rec or "loyalty" in rec.lower()

    at_risk_seg, _, _ = assign_rfm_segment(1, 4, 4)
    assert at_risk_seg == "Can't Lose Them" or at_risk_seg == "At-Risk"

    new_seg, _, _ = assign_rfm_segment(5, 1, 2)
    assert new_seg == "New Customers" or new_seg == "Potential Loyalists"

def test_compute_rfm_segmentation_metrics(mock_transaction_dataset):
    results = compute_rfm_segmentation(
        df=mock_transaction_dataset,
        customer_col="user_id",
        date_col="order_date",
        monetary_col="amount",
        reference_date_str="2026-03-05"
    )

    assert results["total_customers"] >= 5
    assert results["total_revenue"] > 1000.0
    assert results["repeat_purchase_rate_pct"] > 0
    assert isinstance(results["segments"], list)
    assert len(results["segments"]) > 0

    # Ensure profile list is properly populated
    profiles = results["customer_profiles"]
    assert len(profiles) > 0
    first_profile = profiles[0]
    assert "customer_id" in first_profile
    assert "segment" in first_profile
    assert "total_spend" in first_profile
    assert "recency_days" in first_profile

def test_compute_cohort_retention_structure(mock_transaction_dataset):
    results = compute_cohort_retention(
        df=mock_transaction_dataset,
        customer_col="user_id",
        date_col="order_date",
        max_periods=6
    )

    assert "cohorts" in results
    assert "periods" in results
    assert len(results["periods"]) == 7  # M0 to M6
    assert len(results["cohorts"]) > 0
    first_cohort = results["cohorts"][0]
    assert "cohort" in first_cohort
    assert "cohort_size" in first_cohort
    assert "retention" in first_cohort
    assert first_cohort["retention"][0] == 100.0  # M0 is always 100%
