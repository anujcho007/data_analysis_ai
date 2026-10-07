import json
from typing import List, Dict, Any, Optional, Tuple
import time
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db, engine
from app.models.dataset import DatasetMetadata
from app.models.user import User
from app.models.schema import TableDataPreview, SchemaRelationship, SQLQueryRequest, SQLQueryResponse
from app.services.schema_builder import (
    get_table_data_preview,
    detect_star_schema_relationships,
    run_sql_query,
    drop_all_warehouse_tables
)
from app.services.sql_security import validate_and_sanitize_sql
from app.services.ai_query import generate_ai_sql
from app.services.ai_dashboard import generate_ai_dashboard, generate_standalone_dashboard_html

router = APIRouter(prefix="/api/tables", tags=["Warehouse & Tables"])

@router.get("")
def list_warehouse_tables(db: Session = Depends(get_db)):
    """List all cleaned tables stored in the local analytical warehouse."""
    datasets = db.query(DatasetMetadata).order_by(DatasetMetadata.created_at.desc()).all()
    results = []
    for d in datasets:
        try:
            schema_info = json.loads(d.schema_json)
        except Exception:
            schema_info = []
        try:
            cleaning_summary = json.loads(d.cleaning_summary_json)
        except Exception:
            cleaning_summary = {}

        results.append({
            "id": d.id,
            "table_name": d.table_name,
            "original_filename": d.original_filename,
            "row_count": d.row_count,
            "column_count": d.column_count,
            "table_type": d.table_type,
            "schema_info": schema_info,
            "cleaning_summary": cleaning_summary,
            "created_at": d.created_at
        })
    return results

@router.get("/relationships", response_model=List[SchemaRelationship])
def get_relationships(db: Session = Depends(get_db)):
    """Return inferred Star Schema relationships between tables."""
    return detect_star_schema_relationships(db)

@router.get("/suggested-queries")
def get_suggested_queries(
    table_name: Optional[str] = Query(None, description="Optional target table name"),
    db: Session = Depends(get_db)
):
    """Return dynamically generated analytical SQL queries based on current schema or selected table."""
    from app.services.schema_builder import generate_dynamic_sample_queries
    return generate_dynamic_sample_queries(db, table_name=table_name)

@router.get("/suggested-prompts")
def get_table_suggested_prompts(
    table_name: Optional[str] = Query(None, description="Optional target table name"),
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Return dynamic plain-English AI prompts tailored to the table's schema and columns."""
    from app.services.prompt_generator import generate_prompts_for_database
    return generate_prompts_for_database(db, target_table=table_name, limit=limit)


@router.get("/stats")
def get_warehouse_stats(db: Session = Depends(get_db)):
    """Return overall warehouse health, counts, and cleaning metrics."""
    datasets = db.query(DatasetMetadata).all()
    users_count = db.query(User).count()
    
    total_rows = sum(d.row_count for d in datasets)
    total_duplicates_removed = 0
    total_nulls_filled = 0

    for d in datasets:
        try:
            summary = json.loads(d.cleaning_summary_json)
            total_duplicates_removed += summary.get("duplicates_removed", 0)
            total_nulls_filled += summary.get("null_values_filled", 0)
        except Exception:
            pass

    return {
        "total_tables": len(datasets),
        "total_rows": total_rows,
        "fact_tables_count": sum(1 for d in datasets if d.table_type == "fact"),
        "dimension_tables_count": sum(1 for d in datasets if d.table_type == "dimension"),
        "total_duplicates_removed": total_duplicates_removed,
        "total_nulls_filled": total_nulls_filled,
        "total_users": users_count
    }

@router.get("/{table_name}/preview", response_model=TableDataPreview)
def preview_table(
    table_name: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Retrieve sample rows from a warehouse table."""
    metadata = db.query(DatasetMetadata).filter(DatasetMetadata.table_name == table_name).first()
    if not metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' does not exist in warehouse."
        )

    try:
        data = get_table_data_preview(table_name, limit=limit, offset=offset)
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error previewing table: {str(e)}"
        )

@router.get("/{table_name}/analytics")
def get_table_analytics(
    table_name: str,
    metric_column: Optional[str] = None,
    category_column: Optional[str] = None,
    date_column: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    High-performance analytical engine for interactive BI dashboards:
    Computes key metrics, categorical distributions, and time-series trends
    using optimized C-level SQLite aggregations.
    """
    metadata = db.query(DatasetMetadata).filter(DatasetMetadata.table_name == table_name).first()
    if not metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_name}' does not exist in warehouse."
        )

    try:
        schema_info = json.loads(metadata.schema_json)
    except Exception:
        schema_info = []

    # Identify candidate column types
    numeric_cols = []
    categorical_cols = []
    date_cols = []

    for c in schema_info:
        c_name = c.get("name")
        c_type = c.get("data_type", "").upper()
        col_lower = c_name.lower()

        if c_type in ["INTEGER", "REAL"] and not col_lower.endswith(('_id', '_key', 'id', 'pk')):
            numeric_cols.append(c_name)
        elif c_type == "TIMESTAMP" or any(kw in col_lower for kw in ['date', 'time', 'timestamp', 'created', 'updated', 'year', 'month']):
            date_cols.append(c_name)
        elif c_type == "TEXT" and not col_lower.endswith(('_id', '_key')):
            categorical_cols.append(c_name)

    # Smart priority for business metrics and category columns
    metric_keywords = ['amount', 'sales', 'revenue', 'price', 'total', 'cost', 'profit', 'val', 'rate', 'rating', 'score']
    prioritized_metrics = [c for c in numeric_cols if any(kw in c.lower() for kw in metric_keywords)]
    default_metric = prioritized_metrics[0] if prioritized_metrics else (numeric_cols[0] if numeric_cols else None)

    category_keywords = ['status', 'city', 'category', 'type', 'cuisine', 'payment', 'method', 'segment', 'tier', 'channel']
    prioritized_categories = [c for c in categorical_cols if any(kw in c.lower() for kw in category_keywords)]
    default_category = prioritized_categories[0] if prioritized_categories else (categorical_cols[0] if categorical_cols else None)

    sel_metric = metric_column if metric_column and metric_column in [c.get("name") for c in schema_info] else default_metric
    sel_category = category_column if category_column and category_column in [c.get("name") for c in schema_info] else default_category
    sel_date = date_column if date_column and date_column in [c.get("name") for c in schema_info] else (date_cols[0] if date_cols else None)

    # Subquery with sampling limit to guarantee sub-second performance even on 10,000,000+ rows
    sample_limit = 200000
    is_sampled = metadata.row_count > sample_limit

    clean_tbl = "".join(c for c in table_name if c.isalnum() or c == "_")
    subquery = f'(SELECT * FROM "{clean_tbl}" LIMIT {sample_limit})' if is_sampled else f'"{clean_tbl}"'

    with engine.connect() as conn:
        # 1. Metric Stats (Sum, Avg, Min, Max)
        metric_stats = {"sum": 0, "avg": 0, "min": 0, "max": 0}
        clean_metric = "".join(c for c in sel_metric if c.isalnum() or c == "_") if sel_metric else None
        if clean_metric:
            sql = f'SELECT SUM("{clean_metric}"), AVG("{clean_metric}"), MIN("{clean_metric}"), MAX("{clean_metric}") FROM {subquery}'
            try:
                row = conn.execute(text(sql)).fetchone()
                if row and row[0] is not None:
                    multiplier = (metadata.row_count / sample_limit) if is_sampled else 1.0
                    metric_stats = {
                        "sum": round(float(row[0]) * multiplier, 2),
                        "avg": round(float(row[1]) if row[1] is not None else 0, 2),
                        "min": round(float(row[2]) if row[2] is not None else 0, 2),
                        "max": round(float(row[3]) if row[3] is not None else 0, 2)
                    }
            except Exception:
                pass

        # 2. Categorical Breakdowns
        breakdowns = []
        target_cats = [sel_category] if sel_category else []
        for cat in categorical_cols:
            if cat not in target_cats and len(target_cats) < 3:
                target_cats.append(cat)

        for cat in target_cats:
            if not cat: continue
            clean_cat = "".join(c for c in cat if c.isalnum() or c == "_")
            val_col = f', SUM("{clean_metric}")' if clean_metric else ', 0'
            cat_sql = f'SELECT "{clean_cat}", COUNT(*) as cnt{val_col} FROM {subquery} WHERE "{clean_cat}" IS NOT NULL GROUP BY "{clean_cat}" ORDER BY cnt DESC LIMIT 12'
            try:
                cat_rows = conn.execute(text(cat_sql)).fetchall()
                cat_total = sum(r[1] for r in cat_rows) or 1
                cat_val_total = sum(float(r[2] or 0) for r in cat_rows) or 1.0
                mult = (metadata.row_count / sample_limit) if is_sampled else 1.0
                breakdowns.append({
                    "column": cat,
                    "data": [
                        {
                            "label": str(r[0]),
                            "count": int(r[1] * mult),
                            "value": round(float(r[2] or 0) * mult, 2),
                            "percentage": round((r[1] / cat_total) * 100, 1),
                            "value_percentage": round((float(r[2] or 0) / cat_val_total) * 100, 1)
                        }
                        for r in cat_rows if r[0] is not None
                    ]
                })
            except Exception:
                pass

        # 3. Time Series Trend
        time_series = []
        if sel_date:
            clean_date = "".join(c for c in sel_date if c.isalnum() or c == "_")
            val_clause = f'SUM("{clean_metric}")' if clean_metric else 'COUNT(*)'
            date_sql = f'''
                SELECT SUBSTR("{clean_date}", 1, 7) as period, COUNT(*), {val_clause}
                FROM {subquery}
                WHERE "{clean_date}" IS NOT NULL AND "{clean_date}" != ''
                GROUP BY period
                ORDER BY period
                LIMIT 36
            '''
            try:
                date_rows = conn.execute(text(date_sql)).fetchall()
                mult = (metadata.row_count / sample_limit) if is_sampled else 1.0
                time_series = [
                    {
                        "period": str(r[0]),
                        "count": int(r[1] * mult),
                        "value": round(float(r[2] or 0) * mult, 2)
                    }
                    for r in date_rows if r[0]
                ]
            except Exception:
                pass

        # 4. Ranked Top Categories by Metric
        rankings = []
        if sel_category and clean_metric:
            clean_cat = "".join(c for c in sel_category if c.isalnum() or c == "_")
            rank_sql = f'''
                SELECT "{clean_cat}", COUNT(*), SUM("{clean_metric}"), AVG("{clean_metric}")
                FROM {subquery}
                WHERE "{clean_cat}" IS NOT NULL
                GROUP BY "{clean_cat}"
                ORDER BY SUM("{clean_metric}") DESC
                LIMIT 10
            '''
            try:
                rank_rows = conn.execute(text(rank_sql)).fetchall()
                mult = (metadata.row_count / sample_limit) if is_sampled else 1.0
                rankings = [
                    {
                        "name": str(r[0]),
                        "count": int(r[1] * mult),
                        "total_value": round(float(r[2] or 0) * mult, 2),
                        "avg_value": round(float(r[3] or 0), 2)
                    }
                    for r in rank_rows if r[0] is not None
                ]
            except Exception:
                pass

        # 5. Histogram Frequency Distribution for Selected Metric
        histogram = []
        if clean_metric and metric_stats.get("max", 0) > metric_stats.get("min", 0):
            min_v = float(metric_stats["min"])
            max_v = float(metric_stats["max"])
            num_bins = 10
            bin_width = (max_v - min_v) / num_bins
            if bin_width > 0:
                histo_sql = f'''
                    SELECT 
                        MIN(CAST(("{clean_metric}" - {min_v}) / {bin_width} AS INTEGER), {num_bins - 1}) as b_idx,
                        COUNT(*) as cnt
                    FROM {subquery}
                    WHERE "{clean_metric}" IS NOT NULL
                    GROUP BY b_idx
                    ORDER BY b_idx
                '''
                try:
                    histo_rows = dict(conn.execute(text(histo_sql)).fetchall())
                    mult = (metadata.row_count / sample_limit) if is_sampled else 1.0
                    for b in range(num_bins):
                        b_start = round(min_v + b * bin_width, 2)
                        b_end = round(min_v + (b + 1) * bin_width, 2)
                        cnt = int(histo_rows.get(b, 0) * mult)
                        histogram.append({
                            "bin_index": b,
                            "bin_label": f"{b_start:g} - {b_end:g}",
                            "range_start": b_start,
                            "range_end": b_end,
                            "count": cnt
                        })
                except Exception:
                    pass
        elif clean_metric and metadata.row_count > 0:
            # Single value or all identical
            val = float(metric_stats.get("min", 0))
            histogram.append({
                "bin_index": 0,
                "bin_label": f"{val:g}",
                "range_start": val,
                "range_end": val,
                "count": metadata.row_count
            })

    return {
        "table_name": table_name,
        "original_filename": metadata.original_filename,
        "total_rows": metadata.row_count,
        "total_columns": metadata.column_count,
        "table_type": metadata.table_type,
        "is_sampled": is_sampled,
        "sampled_records": min(sample_limit, metadata.row_count),
        "selected_metric": sel_metric,
        "selected_category": sel_category,
        "selected_date": sel_date,
        "metric_stats": metric_stats,
        "categorical_breakdowns": breakdowns,
        "time_series": time_series,
        "rankings": rankings,
        "histogram": histogram,
        "available_numeric_cols": numeric_cols,
        "available_categorical_cols": categorical_cols,
        "available_date_cols": date_cols
    }


class CrossAnalyticsRequest(BaseModel):
    primary_table: str
    dimension_table: str
    dimension_column: str
    metric_table: Optional[str] = None
    metric_column: Optional[str] = None
    aggregation: str = "SUM"  # SUM, AVG, COUNT, MIN, MAX
    join_type: str = "LEFT"   # LEFT, INNER
    order_direction: str = "DESC"  # DESC, ASC
    limit: int = 15


def resolve_table_join(
    primary_table: str, 
    target_table: str, 
    relationships: List[Dict[str, Any]], 
    tables_meta: Dict[str, List[str]]
) -> List[Tuple[str, str, str, str, str]]:
    """
    Finds direct 1-hop or 2-hop transitive join path between primary_table and target_table.
    Returns list of tuples: (from_tbl, from_col, to_tbl, to_col, rel_type).
    """
    if primary_table == target_table:
        return []

    # 1. Direct 1-hop match in detected Star Schema relationships
    for rel in relationships:
        s_tbl = rel.get("source_table")
        t_tbl = rel.get("target_table")
        s_col = rel.get("source_column")
        t_col = rel.get("target_column")
        if s_tbl == primary_table and t_tbl == target_table:
            return [(primary_table, s_col, target_table, t_col, "star_schema")]
        if s_tbl == target_table and t_tbl == primary_table:
            return [(primary_table, t_col, target_table, s_col, "star_schema_reverse")]

    # 2. Direct 1-hop shared column match (key-like or entity abbreviations)
    p_cols = tables_meta.get(primary_table, [])
    t_cols = tables_meta.get(target_table, [])
    common = [c for c in p_cols if c in t_cols]
    key_like = [c for c in common if c.endswith(('_id', '_key', '_code', 'id')) or c in ['f_id', 'r_id', 'm_id', 'u_id', 'o_id', 'user_id', 'id']]
    if key_like:
        return [(primary_table, key_like[0], target_table, key_like[0], "shared_key")]

    # Direct entity matching (e.g. orders.r_id -> restaurant.id)
    for col in p_cols:
        c_low = col.lower()
        if c_low == f"{target_table}_id" and "id" in t_cols:
            return [(primary_table, col, target_table, "id", "entity_key")]
        if c_low == "r_id" and target_table == "restaurant" and "id" in t_cols:
            return [(primary_table, col, target_table, "id", "entity_abbr")]
        if c_low == "f_id" and target_table == "food" and ("id" in t_cols or "f_id" in t_cols):
            target_col = "f_id" if "f_id" in t_cols else "id"
            return [(primary_table, col, target_table, target_col, "entity_abbr")]

    if common:
        return [(primary_table, common[0], target_table, common[0], "shared_column")]

    # 3. 2-Hop Transitive Bridge Join (e.g. orders -> order_items -> food, or orders -> menu -> food)
    all_tables = list(tables_meta.keys())
    for bridge in all_tables:
        if bridge in (primary_table, target_table):
            continue
        
        # Check hop 1: primary -> bridge
        hop1 = resolve_table_join(primary_table, bridge, relationships, tables_meta)
        if hop1 and len(hop1) == 1:
            # Check hop 2: bridge -> target
            hop2 = resolve_table_join(bridge, target_table, relationships, tables_meta)
            if hop2 and len(hop2) == 1:
                return [hop1[0], hop2[0]]

    return []


@router.post("/cross-analytics")
def get_cross_table_analytics(
    req: CrossAnalyticsRequest,
    db: Session = Depends(get_db)
):
    """
    Executes high-speed relational multi-table aggregation across Star Schema tables.
    Features:
    - Multi-hop foreign key bridge discovery
    - Sub-second projected statistical sampling on multi-million row tables
    - Fast aggregation scaling for SUM and COUNT
    """
    t_start = time.time()
    all_datasets = db.query(DatasetMetadata).all()
    datasets_by_name = {d.table_name: d for d in all_datasets}
    
    if req.primary_table not in datasets_by_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Primary table '{req.primary_table}' does not exist in warehouse."
        )
    if req.dimension_table not in datasets_by_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dimension table '{req.dimension_table}' does not exist in warehouse."
        )
    
    metric_tbl = req.metric_table or req.primary_table
    if metric_tbl not in datasets_by_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Metric table '{metric_tbl}' does not exist in warehouse."
        )

    # Collect column names per table
    tables_meta = {}
    for d in all_datasets:
        try:
            s_info = json.loads(d.schema_json)
            tables_meta[d.table_name] = [c.get("name") for c in s_info]
        except Exception:
            tables_meta[d.table_name] = []

    # Sanitize names
    clean_primary = "".join(c for c in req.primary_table if c.isalnum() or c == "_")
    clean_dim_tbl = "".join(c for c in req.dimension_table if c.isalnum() or c == "_")
    clean_dim_col = "".join(c for c in req.dimension_column if c.isalnum() or c == "_")
    clean_metric_tbl = "".join(c for c in metric_tbl if c.isalnum() or c == "_")
    clean_metric_col = "".join(c for c in (req.metric_column or "") if c.isalnum() or c == "_")

    # Validate aggregation
    valid_aggs = {"SUM", "AVG", "COUNT", "MIN", "MAX"}
    agg = req.aggregation.upper() if req.aggregation.upper() in valid_aggs else "SUM"
    clean_order = "ASC" if req.order_direction.upper() == "ASC" else "DESC"
    clean_limit = max(1, min(int(req.limit), 100))

    relationships = detect_star_schema_relationships(db)
    
    # Resolve join paths for required tables
    tables_to_join = set()
    if clean_dim_tbl != clean_primary:
        tables_to_join.add(clean_dim_tbl)
    if clean_metric_tbl != clean_primary:
        tables_to_join.add(clean_metric_tbl)

    all_join_hops = []
    for target_tbl in tables_to_join:
        path = resolve_table_join(clean_primary, target_tbl, relationships, tables_meta)
        if not path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot find relational path between base table '{clean_primary}' and target table '{target_tbl}'."
            )
        all_join_hops.extend(path)

    # Build SQL JOIN clauses
    joins_sql_parts = []
    already_joined = set()
    relationships_used = []

    for hop in all_join_hops:
        from_t, from_c, to_t, to_c, rel_type = hop
        if to_t not in already_joined and to_t != clean_primary:
            already_joined.add(to_t)
            joins_sql_parts.append(
                f'LEFT JOIN "{to_t}" ON "{from_t}"."{from_c}" = "{to_t}"."{to_c}"'
            )
            relationships_used.append({
                "from_table": from_t,
                "from_column": from_c,
                "to_table": to_t,
                "to_column": to_c,
                "type": rel_type
            })

    joins_clause = " " + " ".join(joins_sql_parts) if joins_sql_parts else ""

    # Metric expression
    if agg == "COUNT" and (not clean_metric_col or clean_metric_col in ["*", "count", "id"]):
        metric_expr = "COUNT(1)"
    else:
        if not clean_metric_col:
            metric_cols = [c for c in tables_meta.get(clean_metric_tbl, []) if not c.endswith(('_id', '_key'))]
            clean_metric_col = metric_cols[0] if metric_cols else "id"
        metric_expr = f'{agg}("{clean_metric_tbl}"."{clean_metric_col}")'

    dim_expr = f'"{clean_dim_tbl}"."{clean_dim_col}"'

    # Optimization: Projected sampling on base table if it contains > 25,000 rows
    primary_meta = datasets_by_name[clean_primary]
    primary_row_count = primary_meta.row_count or 0
    sample_limit = 20000
    is_sampled = primary_row_count > sample_limit

    if is_sampled:
        # Collect only the required columns from primary table to leverage covering indexes
        needed_cols = set()
        if clean_dim_tbl == clean_primary:
            needed_cols.add(f'"{clean_dim_col}"')
        if clean_metric_tbl == clean_primary and clean_metric_col and clean_metric_col not in ["*", "count"]:
            needed_cols.add(f'"{clean_metric_col}"')
        for hop in all_join_hops:
            if hop[0] == clean_primary:
                needed_cols.add(f'"{hop[1]}"')
        
        proj = ", ".join(needed_cols) if needed_cols else "*"
        base_from = f'(SELECT {proj} FROM "{clean_primary}" LIMIT {sample_limit}) AS "{clean_primary}"'
        scale_multiplier = primary_row_count / sample_limit
    else:
        base_from = f'"{clean_primary}"'
        scale_multiplier = 1.0

    query = f"""
    SELECT
        {dim_expr} AS label,
        {metric_expr} AS value,
        COUNT(1) AS count
    FROM {base_from}{joins_clause}
    WHERE {dim_expr} IS NOT NULL AND {dim_expr} != ''
    GROUP BY {dim_expr}
    ORDER BY value {clean_order}
    LIMIT {clean_limit}
    """

    chart_data = []
    with engine.connect() as conn:
        try:
            conn.execute(text("PRAGMA temp_store = MEMORY"))
            conn.execute(text("PRAGMA cache_size = -64000"))
            rows = conn.execute(text(query)).fetchall()
            for r in rows:
                lbl = str(r[0]) if r[0] is not None else "Unknown"
                val = float(r[1]) if r[1] is not None else 0.0
                cnt = int(r[2]) if r[2] is not None else 0

                # Scale SUM and COUNT if sampled
                if is_sampled and agg in ("SUM", "COUNT"):
                    val = val * scale_multiplier
                    cnt = int(cnt * scale_multiplier)

                chart_data.append({
                    "label": lbl,
                    "value": round(val, 2),
                    "count": cnt
                })
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cross-table query failed: {str(e)}"
            )

    execution_time_ms = round((time.time() - t_start) * 1000, 2)
    total_val = sum(item["value"] for item in chart_data)
    total_cnt = sum(item["count"] for item in chart_data)
    for item in chart_data:
        item["percentage"] = round((item["value"] / total_val * 100), 1) if total_val > 0 else 0.0

    kpis = {
        "total_value": round(total_val, 2),
        "total_count": total_cnt,
        "avg_value": round(total_val / len(chart_data), 2) if chart_data else 0.0,
        "item_count": len(chart_data),
        "top_item": chart_data[0]["label"] if chart_data else None,
        "top_value": chart_data[0]["value"] if chart_data else 0.0,
        "top_share_pct": chart_data[0]["percentage"] if chart_data else 0.0
    }

    return {
        "primary_table": clean_primary,
        "dimension_table": clean_dim_tbl,
        "dimension_column": clean_dim_col,
        "metric_table": clean_metric_tbl,
        "metric_column": clean_metric_col,
        "aggregation": agg,
        "chart_data": chart_data,
        "kpis": kpis,
        "relationships_used": relationships_used,
        "generated_sql": query.strip(),
        "is_sampled": is_sampled,
        "sample_size": sample_limit if is_sampled else primary_row_count,
        "total_rows": primary_row_count,
        "execution_time_ms": execution_time_ms
    }


class AIQueryRequest(BaseModel):
    prompt: str
    table_name: Optional[str] = None


@router.post("/ai-query")
def execute_ai_natural_language_query(
    req: AIQueryRequest,
    db: Session = Depends(get_db)
):
    """
    Translates natural language prompts (e.g. 'top 10 cuisine') into SQL,
    validates multi-layer security guardrails, executes read-only SQL,
    and returns verified data with full security metadata.
    """
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    # 1. Translate natural language prompt to SQL query
    generated_sql, explanation, provider = generate_ai_sql(req.prompt, db, req.table_name)

    # 2. Multi-layer security gatekeeper
    allowed_tables = {d.table_name for d in db.query(DatasetMetadata).all()}
    is_safe, safe_sql, error_msg, sec_meta = validate_and_sanitize_sql(generated_sql, allowed_tables)

    if not is_safe:
        return {
            "success": False,
            "is_safe": False,
            "prompt": req.prompt,
            "sql": generated_sql,
            "explanation": explanation,
            "provider": provider,
            "error": error_msg,
            "security_checks": sec_meta,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "execution_time_ms": 0
        }

    # 3. Execute using read-only SQLite URI with timeout
    start_time = time.time()
    try:
        from app.config import DB_PATH
        import sqlite3
        ro_uri = f"file:{DB_PATH.as_posix()}?mode=ro"
        with sqlite3.connect(ro_uri, uri=True, timeout=30) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(safe_sql)
            raw_rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = [dict(r) for r in raw_rows]
            exec_time = round((time.time() - start_time) * 1000, 2)

        return {
            "success": True,
            "is_safe": True,
            "prompt": req.prompt,
            "sql": safe_sql,
            "explanation": explanation,
            "provider": provider,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "execution_time_ms": exec_time,
            "security_checks": sec_meta
        }
    except Exception as e:
        return {
            "success": False,
            "is_safe": True,
            "prompt": req.prompt,
            "sql": safe_sql,
            "explanation": explanation,
            "provider": provider,
            "error": f"Execution error: {str(e)}",
            "security_checks": sec_meta,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "execution_time_ms": round((time.time() - start_time) * 1000, 2)
        }


class AIDashboardRequest(BaseModel):
    prompt: Optional[str] = ""
    focus_table: Optional[str] = None

class AIDashboardExportRequest(BaseModel):
    dashboard: Dict[str, Any]

@router.post("/ai-dashboard")
def create_ai_dashboard(
    req: AIDashboardRequest,
    db: Session = Depends(get_db)
):
    """
    Analyzes warehouse datasets, generates executive KPIs, multi-chart setups,
    and narrative business insights with Gemini / OpenAI or built-in semantic engine.
    """
    try:
        dashboard = generate_ai_dashboard(db, prompt=req.prompt or "", focus_table=req.focus_table)
        return dashboard
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI Dashboard: {str(e)}"
        )

@router.post("/ai-dashboard/export-html")
def export_ai_dashboard_html(
    req: AIDashboardExportRequest
):
    """
    Generates and returns an interactive, self-contained standalone HTML report file
    with embedded charts, responsive styling, and print/PDF support.
    """
    try:
        html_content = generate_standalone_dashboard_html(req.dashboard)
        filename = f"ai_dashboard_{int(time.time())}.html"
        return Response(
            content=html_content,
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export HTML dashboard: {str(e)}"
        )


@router.post("/query", response_model=SQLQueryResponse)
def query_warehouse(query_req: SQLQueryRequest, db: Session = Depends(get_db)):
    """Execute custom SELECT queries across warehouse tables with strict security checks."""
    allowed_tables = {d.table_name for d in db.query(DatasetMetadata).all()}
    is_safe, safe_sql, error_msg, _ = validate_and_sanitize_sql(query_req.query, allowed_tables)
    if not is_safe:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    try:
        res = run_sql_query(safe_sql)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"SQL Execution Error: {str(e)}")

@router.delete("/all", status_code=status.HTTP_200_OK)
def reset_warehouse(db: Session = Depends(get_db)):
    """Drop all warehouse tables and clear metadata."""
    drop_all_warehouse_tables(db)
    return {"message": "All warehouse tables have been dropped and warehouse reset successfully."}

@router.delete("/{table_name}")
def delete_table(table_name: str, db: Session = Depends(get_db)):
    """Delete a table from warehouse and metadata."""
    clean_name = re.sub(r'[^a-zA-Z0-9_]', '', table_name)
    metadata = db.query(DatasetMetadata).filter(DatasetMetadata.table_name == clean_name).first()
    if not metadata:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found.")

    import sqlite3
    from app.config import DB_PATH
    try:
        db.commit()
    except Exception:
        db.rollback()

    try:
        with sqlite3.connect(DB_PATH.as_posix(), timeout=10, isolation_level=None) as raw_conn:
            raw_conn.execute("PRAGMA busy_timeout = 5000")
            raw_conn.execute(f'DROP TABLE IF EXISTS "{clean_name}"')
    except Exception:
        pass

    db.delete(metadata)
    db.commit()
    return {"message": f"Table '{clean_name}' deleted successfully."}

