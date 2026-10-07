import pytest
from app.services.prompt_generator import (
    extract_table_semantics,
    generate_prompts_for_table,
    generate_prompts_for_database,
    generate_suggested_queries_for_table
)
from app.models.dataset import DatasetMetadata
import json

def test_extract_table_semantics_metrics_and_dimensions():
    schema = [
        {"name": "order_id", "data_type": "INTEGER", "unique_count": 500, "is_unique": True, "sample_values": [1, 2]},
        {"name": "total_amount", "data_type": "REAL", "unique_count": 450, "sample_values": [99.5, 149.0]},
        {"name": "cuisine", "data_type": "TEXT", "unique_count": 8, "sample_values": ["Italian", "Japanese"]},
        {"name": "order_date", "data_type": "DATE", "unique_count": 30, "sample_values": ["2026-05-01"]},
        {"name": "status", "data_type": "TEXT", "unique_count": 3, "sample_values": ["DELIVERED", "CANCELLED"]},
    ]
    semantics = extract_table_semantics("orders", schema, row_count=500)
    
    assert "total_amount" in semantics["metrics"]
    assert "order_id" in semantics["identifiers"]
    assert "cuisine" in semantics["dimensions"]
    assert "order_date" in semantics["dates"]
    assert "status" in semantics["statuses"]

def test_generate_prompts_for_table():
    schema = [
        {"name": "total_input_token_count", "data_type": "REAL", "unique_count": 200, "sample_values": [1500.0, 2400.0]},
        {"name": "api_name", "data_type": "TEXT", "unique_count": 4, "sample_values": ["summarize_text", "extract_entities"]},
        {"name": "execution_start_datetime", "data_type": "TEXT", "unique_count": 200, "sample_values": ["2026-06-01 12:00:00"]},
        {"name": "status", "data_type": "TEXT", "unique_count": 2, "sample_values": ["SUCCESS", "ERROR"]},
    ]
    prompts = generate_prompts_for_table("transactions", schema, row_count=1000, limit=6)
    
    assert len(prompts) >= 4
    # Prompts must specifically mention the actual column names!
    assert any("total_input_token_count" in p for p in prompts)
    assert any("api_name" in p for p in prompts)
    assert any("transactions" in p for p in prompts)
    assert any("execution_start_datetime" in p or "time" in p.lower() for p in prompts)

def test_generate_suggested_queries_for_table():
    schema = [
        {"name": "cost", "data_type": "REAL", "sample_values": [12.5, 45.0]},
        {"name": "channel", "data_type": "TEXT", "sample_values": ["Google Ads", "Meta"]},
        {"name": "created_at", "data_type": "DATETIME", "sample_values": ["2026-01-10 10:00:00"]},
    ]
    queries = generate_suggested_queries_for_table("ad_campaigns", schema, row_count=500, limit=5)
    
    assert len(queries) >= 3
    # Check that labels and queries are valid
    preview = next(q for q in queries if "Preview" in q["label"])
    assert 'SELECT * FROM "ad_campaigns"' in preview["query"]
    
    cost_grouped = next((q for q in queries if "channel" in q["label"].lower() or "cost" in q["label"].lower()), None)
    assert cost_grouped is not None
    assert 'GROUP BY "channel"' in cost_grouped["query"]

def test_generate_prompts_for_database_empty(in_memory_db):
    # Empty DB fallback
    in_memory_db.query(DatasetMetadata).delete()
    in_memory_db.commit()
    prompts = generate_prompts_for_database(in_memory_db)
    assert len(prompts) > 0
    assert "upload" in prompts[1].lower()

def test_generate_prompts_for_database_with_data(in_memory_db):
    # Add a mock metadata table
    meta = DatasetMetadata(
        table_name="customer_orders_test",
        original_filename="orders.csv",
        row_count=100,
        column_count=3,
        table_type="fact",
        schema_json=json.dumps([
            {"name": "revenue", "data_type": "REAL", "unique_count": 90, "sample_values": [50.0, 100.0]},
            {"name": "segment", "data_type": "TEXT", "unique_count": 3, "sample_values": ["Enterprise", "SMB"]},
        ]),
        cleaning_summary_json="{}"
    )
    in_memory_db.add(meta)
    in_memory_db.commit()
    
    prompts = generate_prompts_for_database(in_memory_db, target_table="customer_orders_test")
    assert len(prompts) > 0
    assert any("revenue" in p for p in prompts)
    assert any("segment" in p for p in prompts)
