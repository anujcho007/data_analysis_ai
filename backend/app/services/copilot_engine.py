import os
import re
import json
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.dataset import DatasetMetadata

logger = logging.getLogger(__name__)

# System prompt template for Gemini LLM
COPILOT_SYSTEM_PROMPT = """You are DataForge AI Copilot, an elite Chief Analytics Officer and Senior Data Engineer assistant.
You help enterprise users query and understand their data warehouse.

Rules:
1. You MUST generate ONLY valid, read-only SQLite SELECT queries. Never generate DROP, DELETE, INSERT, UPDATE, ALTER, or PRAGMA statements.
2. If the user's question can be answered with a query, return a JSON object with:
   {
     "thought": "brief chain of thought explaining how to answer",
     "sql": "SELECT ... FROM ... LIMIT 25;",
     "explanation": "Executive commentary explaining the finding and context",
     "suggested_chart": {"type": "bar"|"line"|"pie"|"kpi", "x_key": "column_name", "y_key": "metric_name"} or null,
     "followup_questions": ["Follow-up question 1", "Follow-up question 2"]
   }
3. If no SQL query is required (e.g. general greeting or conceptual question), leave "sql" as null and provide a helpful, data-driven "explanation".
4. Schema of available tables:
{schema_text}
"""

def extract_warehouse_schema_summary(db: Session) -> str:
    """Extract table and column metadata for LLM context."""
    datasets = db.query(DatasetMetadata).all()
    lines = []
    for d in datasets:
        cols = []
        try:
            schema_info = json.loads(d.schema_json) if d.schema_json else []
        except Exception:
            schema_info = []
        for c in schema_info:
            cols.append(f"{c.get('name')} ({c.get('data_type')})")
        lines.append(f"Table '{d.table_name}' ({d.row_count} rows, {d.table_type or 'General'}): columns=[{', '.join(cols)}]")
    return "\n".join(lines)

def execute_safe_sql(db: Session, sql_query: str) -> Dict[str, Any]:
    """Execute a strictly read-only SQL query against the warehouse database."""
    cleaned = sql_query.strip().rstrip(";")
    upper = cleaned.upper()
    
    # Security guardrails: strictly allow only SELECT queries
    forbidden_tokens = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE", "REPLACE", "PRAGMA", "ATTACH", "DETACH"]
    for token in forbidden_tokens:
        # Match as standalone word
        if re.search(r'\b' + token + r'\b', upper):
            raise ValueError(f"Security Alert: '{token}' operations are forbidden in DataForge Copilot.")
            
    if not upper.startswith("SELECT") and not upper.startswith("WITH"):
        raise ValueError("Only SELECT or WITH (CTE) queries can be executed.")

    # Limit rows to 100 max
    if "LIMIT" not in upper:
        cleaned += " LIMIT 50"

    result = db.execute(text(cleaned))
    keys = list(result.keys())
    rows = [dict(zip(keys, row)) for row in result.fetchmany(50)]
    return {
        "columns": keys,
        "rows": rows,
        "row_count": len(rows)
    }

def heuristic_query_engine(query_text: str, db: Session) -> Dict[str, Any]:
    """
    High-precision heuristic fallback when Gemini API key is not configured or offline.
    Automatically parses intent, matches warehouse tables and columns, and generates SQL.
    """
    q_lower = query_text.lower()
    datasets = db.query(DatasetMetadata).all()
    if not datasets:
        return {
            "thought": "No datasets available in warehouse.",
            "sql": None,
            "explanation": "No data tables found in your warehouse. Please upload CSVs or connect a SQL database first.",
            "data": None,
            "suggested_chart": None,
            "followup_questions": ["How do I connect a database?", "What file formats are supported?"]
        }

    # Find the most relevant table mentioned or inferred
    target_table = None
    for d in datasets:
        t_clean = d.table_name.lower().replace("_", " ")
        if t_clean in q_lower or d.table_name.lower() in q_lower:
            target_table = d
            break
            
    if not target_table:
        # Default to first fact table or first available dataset
        target_table = next((d for d in datasets if (d.table_type or '').upper() == "FACT"), datasets[0])

    t_name = target_table.table_name
    try:
        schema = json.loads(target_table.schema_json) if target_table.schema_json else []
    except Exception:
        schema = []
    num_cols = [c["name"] for c in schema if c.get("data_type") in ("INTEGER", "FLOAT", "NUMERIC", "REAL")]
    cat_cols = [c["name"] for c in schema if c.get("data_type") in ("VARCHAR", "TEXT", "STRING") and not c["name"].endswith("_id")]
    date_cols = [c["name"] for c in schema if "date" in c["name"].lower() or "time" in c["name"].lower()]

    metric_col = num_cols[0] if num_cols else "*"
    cat_col = cat_cols[0] if cat_cols else (schema[0]["name"] if schema else "id")

    # Intent 1: Top / Highest / Best performers
    if any(k in q_lower for k in ["top", "highest", "best", "most", "largest", "maximum"]):
        if metric_col != "*" and cat_col:
            sql = f"SELECT {cat_col}, SUM({metric_col}) AS total_{metric_col} FROM {t_name} GROUP BY {cat_col} ORDER BY total_{metric_col} DESC LIMIT 10"
            explanation = f"Analyzed top performers in `{t_name}` grouped by `{cat_col}` sorted by total `{metric_col}`."
            chart = {"type": "bar", "x_key": cat_col, "y_key": f"total_{metric_col}"}
        else:
            sql = f"SELECT * FROM {t_name} LIMIT 10"
            explanation = f"Retrieved top records from `{t_name}`."
            chart = None

    # Intent 2: Bottom / Lowest / Worst performers
    elif any(k in q_lower for k in ["bottom", "lowest", "worst", "least", "minimum", "drop"]):
        if metric_col != "*" and cat_col:
            sql = f"SELECT {cat_col}, SUM({metric_col}) AS total_{metric_col} FROM {t_name} GROUP BY {cat_col} ORDER BY total_{metric_col} ASC LIMIT 10"
            explanation = f"Identified lowest performing segments in `{t_name}` by `{metric_col}`."
            chart = {"type": "bar", "x_key": cat_col, "y_key": f"total_{metric_col}"}
        else:
            sql = f"SELECT * FROM {t_name} LIMIT 10"
            explanation = f"Retrieved sample records from `{t_name}`."
            chart = None

    # Intent 3: Trend over time / Date distribution
    elif any(k in q_lower for k in ["trend", "time", "month", "over time", "timeline", "history", "forecast"]) and date_cols:
        d_col = date_cols[0]
        if metric_col != "*":
            sql = f"SELECT {d_col}, SUM({metric_col}) AS total_{metric_col} FROM {t_name} GROUP BY {d_col} ORDER BY {d_col} ASC LIMIT 30"
            chart = {"type": "line", "x_key": d_col, "y_key": f"total_{metric_col}"}
        else:
            sql = f"SELECT {d_col}, COUNT(*) AS total_count FROM {t_name} GROUP BY {d_col} ORDER BY {d_col} ASC LIMIT 30"
            chart = {"type": "line", "x_key": d_col, "y_key": "total_count"}
        explanation = f"Calculated temporal trajectory across `{d_col}` in `{t_name}`."

    # Intent 4: Distribution / Breakdown / Group by
    elif any(k in q_lower for k in ["distribution", "breakdown", "category", "share", "percentage", "split"]) and cat_col:
        sql = f"SELECT {cat_col}, COUNT(*) AS record_count FROM {t_name} GROUP BY {cat_col} ORDER BY record_count DESC LIMIT 8"
        explanation = f"Categorical breakdown of `{t_name}` segmented by `{cat_col}`."
        chart = {"type": "pie", "x_key": cat_col, "y_key": "record_count"}

    # Intent 5: Summary / Stats / Count / Average / Total
    elif any(k in q_lower for k in ["summary", "total", "count", "average", "avg", "how many", "sum"]):
        if metric_col != "*":
            sql = f"SELECT COUNT(*) AS total_rows, AVG({metric_col}) AS avg_{metric_col}, SUM({metric_col}) AS sum_{metric_col}, MIN({metric_col}) AS min_{metric_col}, MAX({metric_col}) AS max_{metric_col} FROM {t_name}"
        else:
            sql = f"SELECT COUNT(*) AS total_rows FROM {t_name}"
        explanation = f"Calculated aggregate summary statistics for `{t_name}`."
        chart = {"type": "kpi", "x_key": None, "y_key": "total_rows"}

    # Default Intent: Recent sample view
    else:
        sql = f"SELECT * FROM {t_name} LIMIT 15"
        explanation = f"Displaying sample records from table `{t_name}` ({target_table.row_count} total rows)."
        chart = None

    try:
        data = execute_safe_sql(db, sql)
    except Exception as e:
        data = {"columns": [], "rows": [], "row_count": 0, "error": str(e)}

    followups = [
        f"Show top 5 segments in {t_name}",
        f"Summarize key averages for {t_name}",
        f"What anomalies exist in {t_name}?"
    ]

    return {
        "thought": f"Targeted table {t_name} based on query semantics.",
        "sql": sql,
        "explanation": explanation,
        "data": data,
        "suggested_chart": chart,
        "followup_questions": followups
    }

def process_copilot_query(user_query: str, db: Session, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """
    Process conversational copilot query via Google Gemini LLM if configured,
    or via high-precision heuristic SQL engine.
    """
    schema_text = extract_warehouse_schema_summary(db)
    api_key = os.getenv("GEMINI_API_KEY")

    # Attempt Gemini API if key is present
    if api_key and api_key.strip() and not api_key.startswith("your_"):
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt = COPILOT_SYSTEM_PROMPT.format(schema_text=schema_text)
            full_prompt = f"{prompt}\n\nUser Question: {user_query}\n\nRespond ONLY with valid JSON."
            response = model.generate_content(full_prompt)
            
            raw_text = response.text.strip()
            # Clean markdown codeblocks if returned
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
                
            parsed = json.loads(raw_text.strip())
            sql = parsed.get("sql")
            data = None
            if sql:
                try:
                    data = execute_safe_sql(db, sql)
                except Exception as sql_err:
                    parsed["explanation"] += f"\n\n*(Note: Automated query execution encountered an error: {str(sql_err)})*"
            
            return {
                "thought": parsed.get("thought", ""),
                "sql": sql,
                "explanation": parsed.get("explanation", ""),
                "data": data,
                "suggested_chart": parsed.get("suggested_chart"),
                "followup_questions": parsed.get("followup_questions", [])
            }
        except Exception as e:
            logger.warning(f"Gemini Copilot generation failed or unavailable ({e}); falling back to heuristic engine.")

    # Fallback to deterministic heuristic engine
    return heuristic_query_engine(user_query, db)
