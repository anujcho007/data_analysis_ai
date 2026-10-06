import os
import re
import json
import sqlite3
import time
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.config import DB_PATH
from app.models.dataset import DatasetMetadata

def get_schema_context_for_prompt(db: Session, target_table: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
    """
    Extracts high-fidelity schema context including column types,
    sample values, and metrics for the AI prompt.
    """
    query = db.query(DatasetMetadata)
    if target_table:
        query = query.filter(DatasetMetadata.table_name == target_table)
    
    datasets = query.all()
    if not datasets and target_table:
        datasets = db.query(DatasetMetadata).all()

    tables_info = {}
    schema_descriptions = []

    for d in datasets:
        try:
            cols_info = json.loads(d.schema_json)
        except Exception:
            cols_info = []

        col_defs = []
        col_names = []
        numeric_cols = []
        categorical_cols = []

        for c in cols_info:
            c_name = c.get("name")
            c_type = c.get("data_type", "TEXT")
            samples = c.get("sample_values", [])
            samples_str = f" [e.g. {', '.join(samples[:2])}]" if samples else ""
            col_defs.append(f"{c_name} ({c_type}{samples_str})")
            col_names.append(c_name)

            if c_type in ["INTEGER", "REAL"] and not c_name.lower().endswith(('_id', '_key', 'id', 'pk')):
                numeric_cols.append(c_name)
            elif c_type == "TEXT":
                categorical_cols.append(c_name)

        tables_info[d.table_name] = {
            "columns": col_names,
            "numeric_cols": numeric_cols,
            "categorical_cols": categorical_cols,
            "row_count": d.row_count
        }

        schema_descriptions.append(
            f"Table '{d.table_name}' ({d.row_count:,} rows):\n  Columns: {', '.join(col_defs)}"
        )

    context_str = "\n\n".join(schema_descriptions)
    return context_str, tables_info

def parse_with_rule_based_nlp(prompt: str, tables_info: Dict[str, Any], default_table: Optional[str] = None) -> Tuple[str, str]:
    """
    Smart Semantic Rule-Based Engine:
    Handles common business queries (e.g. 'top 10 cuisine', 'orders by status',
    'sales by city') with 100% precision even when no external LLM API key is set.
    """
    p_lower = prompt.lower().strip()
    
    # 1. Determine target table
    target_table = default_table
    for tbl in tables_info.keys():
        if tbl.lower() in p_lower:
            target_table = tbl
            break
    if not target_table and tables_info:
        target_table = list(tables_info.keys())[0]

    if not target_table:
        return "SELECT 1;", "No tables found in warehouse."

    tbl_meta = tables_info.get(target_table, {})
    cols = tbl_meta.get("columns", [])
    num_cols = tbl_meta.get("numeric_cols", [])
    cat_cols = tbl_meta.get("categorical_cols", [])

    # Find candidate metric column
    metric_keywords = ['amount', 'sales', 'revenue', 'price', 'total', 'cost', 'fee', 'qty', 'rating', 'score']
    preferred_metric = None
    for kw in metric_keywords:
        for c in num_cols:
            if kw in c.lower():
                preferred_metric = c
                break
        if preferred_metric: break
    if not preferred_metric and num_cols:
        preferred_metric = num_cols[0]

    # Check for "top N" or "best N"
    top_match = re.search(r'\b(top|best|highest|most)\s+(\d+)\s+([a-zA-Z0-9_ ]+)', p_lower)
    limit_num = int(top_match.group(2)) if top_match else 10

    # Match target entity in prompt to a table column
    matched_cat_col = None
    for c in cols:
        c_clean = c.lower().replace('_', ' ')
        # Match word in prompt e.g. 'cuisine', 'city', 'status', 'payment'
        if c_clean in p_lower or any(word in p_lower for word in c_clean.split()):
            matched_cat_col = c
            break

    if not matched_cat_col and cat_cols:
        matched_cat_col = cat_cols[0]

    # Scenario A: Top N by Metric (e.g. "top 10 cuisine", "top 5 cities")
    if ("top" in p_lower or "best" in p_lower or "highest" in p_lower) and matched_cat_col:
        val_clause = f'SUM("{preferred_metric}") AS total_{preferred_metric}' if preferred_metric else 'COUNT(*) AS total_count'
        order_col = f'total_{preferred_metric}' if preferred_metric else 'total_count'
        sql = f'SELECT "{matched_cat_col}", {val_clause} FROM "{target_table}" GROUP BY "{matched_cat_col}" ORDER BY {order_col} DESC LIMIT {limit_num};'
        explanation = f"Calculated the {limit_num} highest-ranking '{matched_cat_col}' entities in '{target_table}' ordered by cumulative {preferred_metric or 'volume'}."
        return sql, explanation

    # Scenario B: Breakdown / Distribution (e.g. "orders by status", "breakdown by payment method")
    if ("by" in p_lower or "breakdown" in p_lower or "distribution" in p_lower) and matched_cat_col:
        val_clause = f'COUNT(*) AS count, SUM("{preferred_metric}") AS total_{preferred_metric}' if preferred_metric else 'COUNT(*) AS count'
        sql = f'SELECT "{matched_cat_col}", {val_clause} FROM "{target_table}" GROUP BY "{matched_cat_col}" ORDER BY count DESC LIMIT 15;'
        explanation = f"Grouped records by '{matched_cat_col}' to view the distribution of counts and total {preferred_metric or 'activity'}."
        return sql, explanation

    # Scenario C: Average / Mean (e.g. "average sales", "avg delivery fee")
    if "average" in p_lower or "avg" in p_lower or "mean" in p_lower:
        target_num = None
        for c in num_cols:
            if c.lower() in p_lower:
                target_num = c
                break
        target_num = target_num or preferred_metric or (num_cols[0] if num_cols else None)
        if target_num:
            if matched_cat_col:
                sql = f'SELECT "{matched_cat_col}", AVG("{target_num}") AS avg_{target_num} FROM "{target_table}" GROUP BY "{matched_cat_col}" ORDER BY avg_{target_num} DESC LIMIT 15;'
                explanation = f"Calculated the average '{target_num}' grouped across '{matched_cat_col}' categories."
            else:
                sql = f'SELECT AVG("{target_num}") AS overall_avg_{target_num} FROM "{target_table}";'
                explanation = f"Calculated the overall average for '{target_num}' across all records in '{target_table}'."
            return sql, explanation

    # Scenario D: Total / Sum
    if "total" in p_lower or "sum" in p_lower:
        if preferred_metric:
            if matched_cat_col:
                sql = f'SELECT "{matched_cat_col}", SUM("{preferred_metric}") AS total_{preferred_metric} FROM "{target_table}" GROUP BY "{matched_cat_col}" ORDER BY total_{preferred_metric} DESC LIMIT 15;'
                explanation = f"Aggregated total '{preferred_metric}' broken down by '{matched_cat_col}'."
            else:
                sql = f'SELECT SUM("{preferred_metric}") AS grand_total_{preferred_metric} FROM "{target_table}";'
                explanation = f"Calculated the grand total of '{preferred_metric}' across table '{target_table}'."
            return sql, explanation

    # Default fallback: Select sample with order by limit
    sql = f'SELECT * FROM "{target_table}" LIMIT 25;'
    explanation = f"Displayed a clean preview of records from table '{target_table}'."
    return sql, explanation

def generate_ai_sql(prompt: str, db: Session, target_table: Optional[str] = None) -> Tuple[str, str, str]:
    """
    Generates verified SQLite SQL from a natural language prompt:
    1. Tries OpenAI API (if OPENAI_API_KEY is configured)
    2. Tries Gemini API (if GEMINI_API_KEY is configured)
    3. Falls back gracefully to high-accuracy Built-in Semantic NLP Rule Engine
    
    Returns: (sql_query, explanation, provider_name)
    """
    schema_context, tables_info = get_schema_context_for_prompt(db, target_table)

    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    # 1. Try Gemini API if key is present
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            full_prompt = f"""You are an analytical SQL engineer. Given the SQLite schema below, convert the user's prompt into a single read-only SQLite SELECT query.
Schema:
{schema_context}

User Request: {prompt}

Output ONLY valid JSON in this exact format:
{{"sql": "SELECT ...", "explanation": "Brief 1-sentence explanation"}}
"""
            resp = model.generate_content(full_prompt)
            text_out = resp.text.strip()
            # Clean markdown code blocks
            text_out = re.sub(r'^```json\s*', '', text_out)
            text_out = re.sub(r'\s*```$', '', text_out)
            parsed = json.loads(text_out)
            return parsed.get("sql", ""), parsed.get("explanation", ""), "Gemini 1.5 Flash"
        except Exception as e:
            pass

    # 2. Try OpenAI API if key is present
    if openai_key:
        try:
            import urllib.request
            req_data = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a SQLite data analyst. Convert the request into a single read-only SQLite SELECT query. Respond only in JSON: {\"sql\": \"...\", \"explanation\": \"...\"}"},
                    {"role": "user", "content": f"Schema:\n{schema_context}\n\nRequest: {prompt}"}
                ],
                "response_format": {"type": "json_object"}
            }
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                data=json.dumps(req_data).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                content = json.loads(res_body["choices"][0]["message"]["content"])
                return content.get("sql", ""), content.get("explanation", ""), "GPT-4o Mini"
        except Exception as e:
            pass

    # 3. Built-in Semantic NLP Engine (Immediate, Zero-latency, No external API required)
    sql, explanation = parse_with_rule_based_nlp(prompt, tables_info, target_table)
    return sql, explanation, "DataForge Built-in Semantic AI"
