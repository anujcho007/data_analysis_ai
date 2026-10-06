import pytest
import pandas as pd
import numpy as np
from app.services.cleaner import clean_column_name, clean_dataframe

def test_clean_column_name_standardization():
    assert clean_column_name("Order ID") == "order_id"
    assert clean_column_name("  Customer Full Name  ") == "customer_full_name"
    assert clean_column_name("Total Revenue ($)") == "total_revenue"
    assert clean_column_name("123_items") == "col_123_items"
    assert clean_column_name("special###chars@@@here") == "special_chars_here"
    assert clean_column_name("___already_underscored___") == "already_underscored"

def test_clean_dataframe_deduplication(sample_dirty_dataframe):
    # Initial has 6 rows with 1 duplicate row (ORD-002 Bob Jones)
    df_clean, summary, schema = clean_dataframe(sample_dirty_dataframe, drop_duplicates=True, fill_nulls=False)
    assert summary["duplicates_removed"] == 1
    assert len(df_clean) == 5

def test_clean_dataframe_numeric_median_imputation(sample_dirty_dataframe):
    df_clean, summary, schema = clean_dataframe(
        sample_dirty_dataframe,
        drop_duplicates=True,
        fill_nulls=True,
        numeric_strategy="median"
    )
    price_col = "price_amount"
    assert price_col in df_clean.columns
    # Nulls in price_amount should be filled with median
    assert df_clean[price_col].isna().sum() == 0
    assert summary["null_values_filled"] > 0

def test_clean_dataframe_numeric_zero_imputation():
    df = pd.DataFrame({
        "metric_a": [10.0, None, 30.0, None],
        "metric_b": ["A", "B", "C", "D"]
    })
    df_clean, summary, schema = clean_dataframe(
        df,
        drop_duplicates=False,
        fill_nulls=True,
        numeric_strategy="zero"
    )
    assert (df_clean["metric_a"] == 0.0).sum() == 2
    assert df_clean["metric_a"].isna().sum() == 0

def test_clean_dataframe_categorical_unknown_imputation():
    df = pd.DataFrame({
        "user_id": [1, 2, 3],
        "department": ["Engineering", None, "Sales"]
    })
    df_clean, summary, schema = clean_dataframe(
        df,
        drop_duplicates=False,
        fill_nulls=True,
        categorical_strategy="unknown"
    )
    assert "Unknown" in df_clean["department"].values
    assert df_clean["department"].isna().sum() == 0

def test_clean_dataframe_schema_metadata_structure(sample_dirty_dataframe):
    df_clean, summary, schema = clean_dataframe(sample_dirty_dataframe, drop_duplicates=True, fill_nulls=True)
    assert isinstance(schema, list)
    col_names = [col["name"] for col in schema]
    assert "order_id" in col_names
    assert "price_amount" in col_names
    for col_info in schema:
        assert "name" in col_info
        assert "data_type" in col_info
        assert "sample_values" in col_info
