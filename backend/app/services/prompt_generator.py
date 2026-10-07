import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.dataset import DatasetMetadata
from app.services.schema_builder import detect_star_schema_relationships

logger = logging.getLogger(__name__)

# Business relevance weights for metric column names
METRIC_PRIORITY_KEYWORDS = [
    "amount", "sales", "revenue", "price", "cost", "spend", "profit",
    "fee", "total", "subtotal", "token", "tokens", "page", "pages",
    "count", "quantity", "qty", "score", "rating", "duration", "latency",
    "time_ms", "impressions", "clicks", "conversions", "ctr", "cpc",
    "margin", "discount", "volume", "balance"
]

# Business relevance weights for dimension column names
DIMENSION_PRIORITY_KEYWORDS = [
    "name", "type", "category", "status", "model", "channel",
    "city", "country", "region", "state", "cuisine", "segment",
    "tier", "brand", "department", "role", "source", "device",
    "platform", "method", "gender", "plan", "code"
]

# Temporal column keywords
DATE_KEYWORDS = [
    "date", "time", "created", "updated", "timestamp", "datetime",
    "year", "month", "day", "hour", "at", "start", "end"
]

# Status / Outcome column keywords
STATUS_KEYWORDS = [
    "status", "status_code", "state", "result", "outcome",
    "error", "error_details", "flag", "is_active", "success"
]

def format_col_label(col_name: str) -> str:
    """Returns a clean, human-readable label for a column name."""
    clean = re.sub(r'[^a-zA-Z0-9_]', '', col_name)
    parts = clean.split('_')
    return " ".join(p.capitalize() for p in parts if p)


def extract_table_semantics(
    table_name: str,
    schema_info: List[Dict[str, Any]],
    row_count: int = 0
) -> Dict[str, Any]:
    """
    Extracts semantic roles (metrics, dimensions, dates, statuses, IDs)
    and sample values from the table schema.
    """
    metrics = []
    dimensions = []
    dates = []
    statuses = []
    identifiers = []
    col_samples: Dict[str, List[Any]] = {}

    for c in schema_info:
        name = c.get("name", "")
        if not name:
            continue

        raw_type = str(c.get("data_type", "")).upper()
        name_lower = name.lower()
        samples = c.get("sample_values", [])
        col_samples[name] = samples
        is_unique = c.get("is_unique", False)
        unique_count = c.get("unique_count", 0)

        # 1. Identifier check: UUID or primary key patterns
        is_id = (
            name_lower.endswith(("_id", "_key", "_uuid", "id", "uuid", "pk"))
            or (is_unique and row_count > 10 and unique_count >= row_count * 0.95)
        )
        if is_id:
            identifiers.append(name)

        # 2. Date / Temporal check
        is_date = (
            raw_type in ("DATE", "DATETIME", "TIMESTAMP")
            or any(dk in name_lower for dk in ["date", "datetime", "timestamp", "created_at", "updated_at"])
            or (any(dk in name_lower for dk in ["time", "start", "end"]) and not raw_type.startswith("INT"))
        )
        if is_date:
            dates.append(name)

        # 3. Status / Outcome check
        is_status = any(sk in name_lower for sk in STATUS_KEYWORDS)
        if is_status:
            statuses.append(name)

        # 4. Metric / Numeric check
        is_numeric = raw_type in ("INTEGER", "REAL", "FLOAT", "NUMERIC", "DOUBLE", "INT", "BIGINT")
        if is_numeric and not is_id and not is_date:
            # Score metric based on business keywords
            score = 0
            for idx, kw in enumerate(METRIC_PRIORITY_KEYWORDS):
                if kw in name_lower:
                    score += (len(METRIC_PRIORITY_KEYWORDS) - idx)
            metrics.append((name, score))

        # 5. Categorical / Dimension check
        is_text = raw_type in ("TEXT", "VARCHAR", "STRING", "CHAR")
        if is_text and not is_id and not is_date:
            # Don't pick huge unstructured JSON or error payloads as primary dimensions
            first_sample = str(samples[0]) if samples else ""
            is_huge_text = len(first_sample) > 120 or first_sample.startswith(("{", "["))
            if not is_huge_text:
                score = 0
                for idx, kw in enumerate(DIMENSION_PRIORITY_KEYWORDS):
                    if kw in name_lower:
                        score += (len(DIMENSION_PRIORITY_KEYWORDS) - idx)
                # Boost if reasonable distinct value count
                if 2 <= unique_count <= 200:
                    score += 15
                dimensions.append((name, score))

    # Sort by priority scores descending
    sorted_metrics = [m[0] for m in sorted(metrics, key=lambda x: x[1], reverse=True)]
    sorted_dimensions = [d[0] for d in sorted(dimensions, key=lambda x: x[1], reverse=True)]

    # Fallback: if no dimension found, check if status column can act as dimension
    if not sorted_dimensions and statuses:
        sorted_dimensions = [s for s in statuses if not s.lower().endswith("details")]

    return {
        "table_name": table_name,
        "row_count": row_count,
        "metrics": sorted_metrics,
        "dimensions": sorted_dimensions,
        "dates": dates,
        "statuses": statuses,
        "identifiers": identifiers,
        "col_samples": col_samples,
    }


def generate_prompts_for_table(
    table_name: str,
    schema_info: List[Dict[str, Any]],
    row_count: int = 0,
    limit: int = 6
) -> List[str]:
    """
    Generates intelligent, plain-English business analytical prompts
    derived directly from the table's actual columns, metrics, and categories.
    """
    semantics = extract_table_semantics(table_name, schema_info, row_count)
    metrics = semantics["metrics"]
    dimensions = semantics["dimensions"]
    dates = semantics["dates"]
    statuses = semantics["statuses"]
    samples = semantics["col_samples"]

    prompts: List[str] = []

    m1 = metrics[0] if len(metrics) > 0 else None
    m2 = metrics[1] if len(metrics) > 1 else None
    d1 = dimensions[0] if len(dimensions) > 0 else None
    d2 = dimensions[1] if len(dimensions) > 1 else None
    dt1 = dates[0] if len(dates) > 0 else None
    st1 = statuses[0] if len(statuses) > 0 else None

    # Prompt 1: Metric Aggregation by Dimension
    if m1 and d1:
        prompts.append(
            f"What is the total and average {m1} grouped by {d1} in '{table_name}'?"
        )
    elif m1:
        prompts.append(
            f"What is the total, average, and max {m1} across '{table_name}'?"
        )
    elif d1:
        prompts.append(
            f"What is the frequency breakdown of records by {d1} in '{table_name}'?"
        )

    # Prompt 2: Top Performers / Highest volume
    if m1 and d1:
        prompts.append(
            f"Show the top 10 {d1} with the highest {m1} in '{table_name}'"
        )
    elif d1:
        prompts.append(
            f"Which are the top 10 most frequent {d1} categories in '{table_name}'?"
        )
    elif m1:
        prompts.append(
            f"Which records have the highest {m1} in '{table_name}'?"
        )

    # Prompt 3: Categorical Breakdown / Distribution
    if d1:
        d1_samples = [str(s) for s in samples.get(d1, [])[:2] if s is not None and str(s).strip()]
        if d1_samples:
            sample_str = f" (e.g., {', '.join(d1_samples)})"
        else:
            sample_str = ""
        prompts.append(
            f"What is the percentage distribution of {d1}{sample_str} in '{table_name}'?"
        )

    # Prompt 4: Temporal Trend / Seasonality
    if dt1 and m1:
        prompts.append(
            f"How has {m1} trended over time across {dt1} in '{table_name}'?"
        )
    elif dt1:
        prompts.append(
            f"What is the daily or weekly activity trend by {dt1} in '{table_name}'?"
        )

    # Prompt 5: Operational Status / Health / Errors
    if st1:
        prompts.append(
            f"What is the distribution of {st1} and failure rates in '{table_name}'?"
        )
    elif d2 and m1:
        prompts.append(
            f"Compare {m1} across different {d2} in '{table_name}'"
        )

    # Prompt 6: Multi-metric correlation or comparison
    if m1 and m2 and d1:
        prompts.append(
            f"How does {m1} compare to {m2} across {d1} in '{table_name}'?"
        )
    elif m1 and m2:
        prompts.append(
            f"What is the correlation and ratio between {m1} and {m2} in '{table_name}'?"
        )

    # Prompt 7: Executive Summary
    prompts.append(
        f"Provide an executive summary of key performance indicators in '{table_name}'"
    )

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for p in prompts:
        if p not in seen:
            seen.add(p)
            deduped.append(p)

    return deduped[:limit]


def generate_prompts_for_database(
    db: Session,
    target_table: Optional[str] = None,
    limit: int = 8
) -> List[str]:
    """
    Generates dynamic prompts based on currently ingested tables in the warehouse.
    Supports focusing on a target table or synthesizing warehouse-wide queries.
    """
    datasets = db.query(DatasetMetadata).all()
    if not datasets:
        return [
            "What can you do?",
            "How do I upload data to the warehouse?",
            "What connectors are supported?",
            "How do I create Star Schema relationships?"
        ]

    # If target_table specified, find it
    if target_table:
        for d in datasets:
            if d.table_name.lower() == target_table.lower():
                try:
                    schema_info = json.loads(d.schema_json) if d.schema_json else []
                except Exception:
                    schema_info = []
                return generate_prompts_for_table(
                    table_name=d.table_name,
                    schema_info=schema_info,
                    row_count=d.row_count,
                    limit=limit
                )

    # Multi-table generation: interleave prompts from each table
    all_prompts: List[str] = []
    relationships = detect_star_schema_relationships(db)

    # Gather per-table prompts
    table_prompt_lists = []
    for d in datasets:
        try:
            schema_info = json.loads(d.schema_json) if d.schema_json else []
        except Exception:
            schema_info = []
        prompts = generate_prompts_for_table(
            table_name=d.table_name,
            schema_info=schema_info,
            row_count=d.row_count,
            limit=4
        )
        if prompts:
            table_prompt_lists.append(prompts)

    # Interleave table prompts so user sees questions from different tables
    max_len = max((len(pl) for pl in table_prompt_lists), default=0)
    for i in range(max_len):
        for pl in table_prompt_lists:
            if i < len(pl):
                all_prompts.append(pl[i])

    # Add cross-table relational prompts if relationships exist
    for rel in relationships[:2]:
        src = rel["source_table"]
        tgt = rel["target_table"]
        col = rel["source_column"]
        all_prompts.append(
            f"How do records in '{src}' correlate with '{tgt}' joined on {col}?"
        )

    # If multiple tables exist without explicit FK
    if len(datasets) >= 2 and not relationships:
        t1, t2 = datasets[0].table_name, datasets[1].table_name
        all_prompts.append(
            f"Compare overall record volume and activity between '{t1}' and '{t2}'"
        )

    # Deduplicate while preserving order
    seen = set()
    result = []
    for p in all_prompts:
        if p not in seen:
            seen.add(p)
            result.append(p)

    return result[:limit]


def generate_suggested_queries_for_table(
    table_name: str,
    schema_info: List[Dict[str, Any]],
    row_count: int = 0,
    limit: int = 5
) -> List[Dict[str, str]]:
    """
    Generates rich, executable SQL queries paired with descriptive labels
    tailored to the actual table columns and data distributions.
    """
    semantics = extract_table_semantics(table_name, schema_info, row_count)
    metrics = semantics["metrics"]
    dimensions = semantics["dimensions"]
    dates = semantics["dates"]
    statuses = semantics["statuses"]

    m1 = metrics[0] if len(metrics) > 0 else None
    d1 = dimensions[0] if len(dimensions) > 0 else None
    dt1 = dates[0] if len(dates) > 0 else None
    st1 = statuses[0] if len(statuses) > 0 else None

    queries: List[Dict[str, str]] = []

    # 1. Preview Query
    queries.append({
        "label": f"Preview {table_name}",
        "query": f'SELECT * FROM "{table_name}" LIMIT 25;'
    })

    # 2. Top Grouped by Metric
    if m1 and d1:
        queries.append({
            "label": f"Top {d1} by Total {m1}",
            "query": (
                f'SELECT "{d1}", COUNT(*) AS record_count,\n'
                f'       ROUND(SUM("{m1}"), 2) AS total_{m1},\n'
                f'       ROUND(AVG("{m1}"), 2) AS avg_{m1}\n'
                f'FROM "{table_name}"\n'
                f'GROUP BY "{d1}"\n'
                f'ORDER BY total_{m1} DESC\n'
                f'LIMIT 10;'
            )
        })
    elif d1:
        queries.append({
            "label": f"Top 10 Most Frequent {d1}",
            "query": (
                f'SELECT "{d1}", COUNT(*) AS record_count\n'
                f'FROM "{table_name}"\n'
                f'GROUP BY "{d1}"\n'
                f'ORDER BY record_count DESC\n'
                f'LIMIT 10;'
            )
        })

    # 3. Categorical Breakdown & Percentage Share
    if d1:
        queries.append({
            "label": f"Breakdown of {d1}",
            "query": (
                f'SELECT "{d1}", COUNT(*) AS count,\n'
                f'       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM "{table_name}"), 1) AS pct_share\n'
                f'FROM "{table_name}"\n'
                f'GROUP BY "{d1}"\n'
                f'ORDER BY count DESC\n'
                f'LIMIT 10;'
            )
        })

    # 4. Temporal Trend
    if dt1 and m1:
        queries.append({
            "label": f"Daily {m1} Trend",
            "query": (
                f'SELECT substr("{dt1}", 1, 10) AS day,\n'
                f'       COUNT(*) AS transaction_count,\n'
                f'       ROUND(SUM("{m1}"), 2) AS total_{m1}\n'
                f'FROM "{table_name}"\n'
                f'WHERE "{dt1}" IS NOT NULL\n'
                f'GROUP BY day\n'
                f'ORDER BY day DESC\n'
                f'LIMIT 30;'
            )
        })
    elif dt1:
        queries.append({
            "label": f"Daily Activity Trend",
            "query": (
                f'SELECT substr("{dt1}", 1, 10) AS day,\n'
                f'       COUNT(*) AS volume\n'
                f'FROM "{table_name}"\n'
                f'WHERE "{dt1}" IS NOT NULL\n'
                f'GROUP BY day\n'
                f'ORDER BY day DESC\n'
                f'LIMIT 30;'
            )
        })

    # 5. Status / Health Breakdown
    if st1:
        queries.append({
            "label": f"Status Breakdown ({st1})",
            "query": (
                f'SELECT "{st1}", COUNT(*) AS total_count,\n'
                f'       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM "{table_name}"), 1) AS pct\n'
                f'FROM "{table_name}"\n'
                f'GROUP BY "{st1}"\n'
                f'ORDER BY total_count DESC;'
            )
        })

    # 6. Overall Metrics Summary
    if m1:
        queries.append({
            "label": f"Statistical Summary of {m1}",
            "query": (
                f'SELECT COUNT(*) AS total_records,\n'
                f'       ROUND(AVG("{m1}"), 2) AS avg_{m1},\n'
                f'       ROUND(MIN("{m1}"), 2) AS min_{m1},\n'
                f'       ROUND(MAX("{m1}"), 2) AS max_{m1}\n'
                f'FROM "{table_name}";'
            )
        })

    return queries[:limit]
