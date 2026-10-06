import pytest
from app.services.sql_security import validate_and_sanitize_sql

def test_safe_select_query_appends_limit():
    sql = "SELECT id, product_name, price FROM products"
    is_safe, sanitized, err, meta = validate_and_sanitize_sql(sql)
    assert is_safe is True
    assert err == ""
    assert meta["read_only"] is True
    assert meta["limit_enforced"] is True
    assert sanitized.endswith("LIMIT 500")

def test_safe_select_query_preserves_custom_limit():
    sql = "SELECT id, total FROM orders LIMIT 20"
    is_safe, sanitized, err, meta = validate_and_sanitize_sql(sql)
    assert is_safe is True
    assert "LIMIT 20" in sanitized
    assert meta["limit_enforced"] is False

def test_excessive_limit_clamped_to_1000():
    sql = "SELECT * FROM sales_data LIMIT 50000"
    is_safe, sanitized, err, meta = validate_and_sanitize_sql(sql)
    assert is_safe is True
    assert "LIMIT 1000" in sanitized
    assert meta["limit_enforced"] is True

def test_block_multi_statement_injection():
    sql = "SELECT * FROM orders; DROP TABLE orders;"
    is_safe, sanitized, err, meta = validate_and_sanitize_sql(sql)
    assert is_safe is False
    assert "Multiple SQL statements are strictly forbidden" in err

@pytest.mark.parametrize("keyword", [
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", 
    "TRUNCATE", "ATTACH", "DETACH", "PRAGMA", "EXEC", "VACUUM"
])
def test_block_destructive_keywords(keyword):
    sql = f"{keyword} TABLE customers"
    is_safe, sanitized, err, meta = validate_and_sanitize_sql(sql)
    assert is_safe is False
    assert "Security Violation" in err

def test_block_nested_destructive_operation():
    sql = "SELECT * FROM products WHERE id IN (UPDATE products SET price = 0)"
    is_safe, sanitized, err, meta = validate_and_sanitize_sql(sql)
    assert is_safe is False
    assert "UPDATE" in meta["forbidden_tokens_found"]

@pytest.mark.parametrize("system_table", [
    "users", "sqlite_master", "alert_rules", "workspaces", "database_connections"
])
def test_block_internal_system_tables(system_table):
    sql = f"SELECT * FROM {system_table}"
    is_safe, sanitized, err, meta = validate_and_sanitize_sql(sql)
    assert is_safe is False
    assert "internal system table" in err
    assert system_table in meta["system_tables_accessed"]

def test_valid_cte_query_passes():
    sql = "WITH top_items AS (SELECT item_name, count(*) as cnt FROM items GROUP BY item_name) SELECT * FROM top_items ORDER BY cnt DESC LIMIT 10"
    is_safe, sanitized, err, meta = validate_and_sanitize_sql(sql)
    assert is_safe is True
    assert err == ""
    assert meta["read_only"] is True
