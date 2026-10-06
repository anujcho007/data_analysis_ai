import os
import re
import json
import time
import sqlite3
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import DB_PATH
from app.core.database import engine
from app.models.dataset import DatasetMetadata
from app.services.schema_builder import detect_star_schema_relationships

def extract_warehouse_deep_profile(db: Session, focus_table: Optional[str] = None) -> Dict[str, Any]:
    """
    Scans the warehouse to extract complete schema, metric distributions, 
    time series trends, and category frequencies for AI dashboard synthesis.
    """
    datasets = db.query(DatasetMetadata).all()
    if not datasets:
        return {"tables": {}, "relationships": [], "total_rows": 0, "table_names": []}

    relationships = detect_star_schema_relationships(db)
    profile = {
        "tables": {},
        "relationships": relationships,
        "total_rows": sum(d.row_count for d in datasets),
        "table_names": [d.table_name for d in datasets]
    }

    with engine.connect() as conn:
        for d in datasets:
            t_name = d.table_name
            if focus_table and t_name != focus_table and len(datasets) > 1:
                # Include basic info for non-focus tables
                profile["tables"][t_name] = {
                    "row_count": d.row_count,
                    "table_type": d.table_type,
                    "columns": []
                }
                continue

            try:
                schema_info = json.loads(d.schema_json)
            except Exception:
                schema_info = []

            numeric_cols = []
            categorical_cols = []
            date_cols = []

            for c in schema_info:
                name = c.get("name")
                c_type = c.get("data_type", "TEXT").upper()
                c_lower = name.lower()

                if c_type in ["INTEGER", "REAL"] and not c_lower.endswith(('_id', '_key', 'id', 'pk')):
                    numeric_cols.append(name)
                elif c_type == "TIMESTAMP" or any(kw in c_lower for kw in ['date', 'time', 'timestamp', 'created', 'year', 'month']):
                    date_cols.append(name)
                elif c_type == "TEXT" and not c_lower.endswith(('_id', '_key')):
                    categorical_cols.append(name)

            # Sample metrics
            sanitized_table = "".join(ch for ch in t_name if ch.isalnum() or ch == "_")
            sample_subquery = f'(SELECT * FROM "{sanitized_table}" LIMIT 100000)'

            col_stats = {}
            for num_col in numeric_cols[:4]:
                clean_col = "".join(ch for ch in num_col if ch.isalnum() or ch == "_")
                try:
                    q = f'SELECT SUM("{clean_col}"), AVG("{clean_col}"), MIN("{clean_col}"), MAX("{clean_col}") FROM {sample_subquery}'
                    r = conn.execute(text(q)).fetchone()
                    if r and r[0] is not None:
                        col_stats[num_col] = {
                            "sum": round(float(r[0]), 2),
                            "avg": round(float(r[1] or 0), 2),
                            "min": round(float(r[2] or 0), 2),
                            "max": round(float(r[3] or 0), 2)
                        }
                except Exception:
                    pass

            top_categories = {}
            for cat_col in categorical_cols[:3]:
                clean_cat = "".join(ch for ch in cat_col if ch.isalnum() or ch == "_")
                try:
                    q = f'SELECT "{clean_cat}", COUNT(*) as cnt FROM {sample_subquery} WHERE "{clean_cat}" IS NOT NULL GROUP BY "{clean_cat}" ORDER BY cnt DESC LIMIT 8'
                    rows = conn.execute(text(q)).fetchall()
                    top_categories[cat_col] = [{"label": str(r[0]), "count": int(r[1])} for r in rows if r[0]]
                except Exception:
                    pass

            time_trend = []
            if date_cols:
                date_c = "".join(ch for ch in date_cols[0] if ch.isalnum() or ch == "_")
                val_c = f', SUM("{numeric_cols[0]}")' if numeric_cols else ''
                try:
                    q = f'SELECT SUBSTR("{date_c}", 1, 7) as period, COUNT(*){val_c} FROM {sample_subquery} WHERE "{date_c}" IS NOT NULL AND "{date_c}" != "" GROUP BY period ORDER BY period LIMIT 24'
                    rows = conn.execute(text(q)).fetchall()
                    time_trend = [
                        {
                            "period": str(r[0]),
                            "count": int(r[1]),
                            "value": round(float(r[2] or r[1]), 2) if len(r) > 2 and r[2] is not None else int(r[1])
                        }
                        for r in rows if r[0]
                    ]
                except Exception:
                    pass

            profile["tables"][t_name] = {
                "row_count": d.row_count,
                "column_count": d.column_count,
                "table_type": d.table_type,
                "numeric_cols": numeric_cols,
                "categorical_cols": categorical_cols,
                "date_cols": date_cols,
                "numeric_stats": col_stats,
                "top_categories": top_categories,
                "time_trend": time_trend
            }

    return profile


def format_currency_or_num(val: float, is_currency: bool = False) -> str:
    """Format large numbers with compact suffix (K, M, B)."""
    if val is None:
        return "0"
    prefix = "$" if is_currency else ""
    abs_v = abs(val)
    if abs_v >= 1_000_000_000:
        return f"{prefix}{val / 1_000_000_000:.2f}B"
    if abs_v >= 1_000_000:
        return f"{prefix}{val / 1_000_000:.2f}M"
    if abs_v >= 10_000:
        return f"{prefix}{val / 1_000:.1f}K"
    if isinstance(val, int) or val.is_integer():
        return f"{prefix}{int(val):,}"
    return f"{prefix}{val:,.2f}"


def build_semantic_rule_dashboard(profile: Dict[str, Any], prompt: str = "") -> Dict[str, Any]:
    """
    Built-in high-accuracy statistical and business intelligence synthesis engine:
    Generates a full executive dashboard with real numbers, multi-chart setups,
    KPIs, and narrative insights without requiring any external LLM API key.
    """
    tables = profile.get("tables", {})
    if not tables:
        return {
            "title": "No Data Available",
            "subtitle": "Please upload CSV datasets first to generate an AI Dashboard.",
            "executive_summary": "The analytical warehouse does not currently contain any cleaned tables.",
            "kpis": [],
            "charts": [],
            "recommendations": [],
            "provider": "DataForge Built-in Semantic AI"
        }

    # Find the primary fact table or table with the most rows/metrics
    fact_table_name = None
    for name, tbl in tables.items():
        if tbl.get("table_type") == "fact":
            fact_table_name = name
            break
    if not fact_table_name:
        fact_table_name = max(tables.keys(), key=lambda k: tables[k].get("row_count", 0))

    fact_tbl = tables[fact_table_name]
    num_stats = fact_tbl.get("numeric_stats", {})
    top_cats = fact_tbl.get("top_categories", {})
    time_trend = fact_tbl.get("time_trend", [])

    # Select key metric
    metric_col = list(num_stats.keys())[0] if num_stats else None
    metric_data = num_stats.get(metric_col, {}) if metric_col else {}
    is_revenue = any(kw in str(metric_col).lower() for kw in ['sales', 'revenue', 'price', 'amount', 'total', 'cost', 'fee'])

    # 1. Build KPIs
    kpis = []
    # KPI 1: Primary Metric Volume / Total Rows
    if metric_col:
        total_val = metric_data.get("sum", 0)
        kpis.append({
            "id": "kpi-1",
            "label": f"Total {metric_col.replace('_', ' ').title()}",
            "value": total_val,
            "formatted_value": format_currency_or_num(total_val, is_revenue),
            "subtitle": f"Across {fact_tbl.get('row_count', 0):,} records in '{fact_table_name}'",
            "trend": "up",
            "badge": "Primary Metric",
            "icon": "dollar" if is_revenue else "activity"
        })
        # KPI 2: Average Ticket / Unit Metric
        avg_val = metric_data.get("avg", 0)
        kpis.append({
            "id": "kpi-2",
            "label": f"Average {metric_col.replace('_', ' ').title()}",
            "value": avg_val,
            "formatted_value": format_currency_or_num(avg_val, is_revenue),
            "subtitle": f"Min {format_currency_or_num(metric_data.get('min', 0), is_revenue)} / Max {format_currency_or_num(metric_data.get('max', 0), is_revenue)}",
            "trend": "neutral",
            "badge": "Mean Value",
            "icon": "trending-up"
        })
    else:
        kpis.append({
            "id": "kpi-1",
            "label": "Total Ingested Records",
            "value": profile.get("total_rows", 0),
            "formatted_value": f"{profile.get('total_rows', 0):,}",
            "subtitle": f"Across {len(tables)} tables in warehouse",
            "trend": "up",
            "badge": "Warehouse",
            "icon": "database"
        })

    # KPI 3: Total Tables & Relational Integrity
    rel_count = len(profile.get("relationships", []))
    kpis.append({
        "id": "kpi-3",
        "label": "Connected Warehouse Tables",
        "value": len(tables),
        "formatted_value": str(len(tables)),
        "subtitle": f"{rel_count} automated Star Schema link(s) detected",
        "trend": "up" if rel_count > 0 else "neutral",
        "badge": "Star Schema",
        "icon": "layers"
    })

    # KPI 4: Dominant Category Share / Lead Entity
    lead_category_name = list(top_cats.keys())[0] if top_cats else None
    if lead_category_name and top_cats[lead_category_name]:
        top_item = top_cats[lead_category_name][0]
        total_cat_count = sum(it["count"] for it in top_cats[lead_category_name])
        pct = round((top_item["count"] / max(total_cat_count, 1)) * 100, 1)
        kpis.append({
            "id": "kpi-4",
            "label": f"Top {lead_category_name.replace('_', ' ').title()}",
            "value": top_item["label"],
            "formatted_value": str(top_item["label"]),
            "subtitle": f"{top_item['count']:,} records ({pct}% concentration)",
            "trend": "up",
            "badge": "Market Leader",
            "icon": "award"
        })

    # 2. Build Multi-Chart Grid
    charts = []

    # Chart 1: Time Series Area / Line Chart
    if time_trend and len(time_trend) > 1:
        charts.append({
            "id": "chart-timeline",
            "title": f"Temporal Activity & Growth Trend",
            "description": f"Historical volume trajectory aggregated by periodic timeline from table '{fact_table_name}'.",
            "chart_type": "area",
            "data": [
                {
                    "label": item["period"],
                    "value": item["value"],
                    "count": item["count"]
                }
                for item in time_trend
            ],
            "x_label": "Timeline Period",
            "y_label": f"Cumulative {metric_col or 'Records'}",
            "color": "#4f46e5",
            "gradient": True
        })

    # Chart 2: Categorical Distribution Donut / Pie
    if lead_category_name and top_cats[lead_category_name]:
        cat_items = top_cats[lead_category_name]
        total_items_sum = sum(i["count"] for i in cat_items) or 1
        charts.append({
            "id": "chart-category-donut",
            "title": f"Distribution by {lead_category_name.replace('_', ' ').title()}",
            "description": f"Proportional share breakdown across leading '{lead_category_name}' segments.",
            "chart_type": "donut",
            "data": [
                {
                    "label": item["label"],
                    "value": item["count"],
                    "percentage": round((item["count"] / total_items_sum) * 100, 1)
                }
                for item in cat_items[:6]
            ],
            "color_palette": ["#4f46e5", "#0284c7", "#059669", "#d97706", "#e11d48", "#7c3aed"]
        })

    # Chart 3: Top Ranked Leaderboard (Horizontal Bar / Rankings)
    second_cat = list(top_cats.keys())[1] if len(top_cats) > 1 else lead_category_name
    if second_cat and top_cats[second_cat]:
        rank_items = top_cats[second_cat]
        charts.append({
            "id": "chart-rankings",
            "title": f"Top Performing {second_cat.replace('_', ' ').title()}s",
            "description": f"Ranked comparison of highest volume contributors in '{second_cat}'.",
            "chart_type": "rankings",
            "data": [
                {
                    "label": item["label"],
                    "value": item["count"],
                    "count": item["count"]
                }
                for item in rank_items[:8]
            ],
            "color": "#0284c7"
        })

    # Chart 4: Dimension Table Insights (if other tables exist)
    for other_name, other_tbl in tables.items():
        if other_name == fact_table_name:
            continue
        other_cats = other_tbl.get("top_categories", {})
        if other_cats:
            first_other_c = list(other_cats.keys())[0]
            items = other_cats[first_other_c]
            if items:
                charts.append({
                    "id": f"chart-{other_name}",
                    "title": f"Cross-Entity Overview: {other_name.title()} ({first_other_c.replace('_', ' ').title()})",
                    "description": f"Cardinality distribution in linked dimension table '{other_name}'.",
                    "chart_type": "bar",
                    "data": [
                        {"label": it["label"], "value": it["count"]}
                        for it in items[:7]
                    ],
                    "color": "#059669"
                })
                break

    # 3. Executive Narrative & Findings
    total_recs = profile.get("total_rows", 0)
    summary_sentences = [
        f"DataForge AI evaluated {len(tables)} relational warehouse table(s) encompassing {total_recs:,} cleaned records."
    ]
    if metric_col:
        sum_str = format_currency_or_num(metric_data.get('sum', 0), is_revenue)
        avg_str = format_currency_or_num(metric_data.get('avg', 0), is_revenue)
        summary_sentences.append(
            f"The primary driver is table '{fact_table_name}' with cumulative {metric_col.replace('_', ' ')} of {sum_str} and a mean transaction size of {avg_str}."
        )
    if lead_category_name and top_cats[lead_category_name]:
        top_name = top_cats[lead_category_name][0]['label']
        summary_sentences.append(
            f"In the '{lead_category_name}' segment, '{top_name}' leads as the dominant contributor."
        )

    findings = [
        f"Total dataset coverage: {total_recs:,} records across {len(tables)} structured warehouse entities.",
        f"Automated Star Schema links detected: {rel_count} referential relationship(s) mapping dimensions to facts.",
    ]
    if metric_col:
        findings.append(f"Aggregate {metric_col.replace('_', ' ')} reaches {format_currency_or_num(metric_data.get('sum', 0), is_revenue)}, showing strong metric density.")
    if time_trend:
        findings.append(f"Temporal velocity spans {len(time_trend)} active recording intervals.")

    recommendations = [
        f"Focus optimization on top tier categories ({lead_category_name or 'primary dimension'}) which account for the majority of volume.",
        "Leverage automated Star Schema foreign key relationships to conduct cross-table cohort analysis.",
        "Periodically refresh chunked CSV ingestion to maintain up-to-date tracking of longitudinal trends."
    ]

    title = f"Executive Intelligence Dashboard: {fact_table_name.replace('_', ' ').title()}"
    subtitle = f"Automated Cross-Warehouse AI Synthesis • Generated on {time.strftime('%b %d, %Y')}"
    if prompt:
        subtitle += f" • Focus: \"{prompt}\""

    return {
        "title": title,
        "subtitle": subtitle,
        "executive_summary": " ".join(summary_sentences),
        "key_findings": findings,
        "kpis": kpis,
        "charts": charts,
        "recommendations": recommendations,
        "provider": "DataForge Built-in Semantic AI",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }


def generate_ai_dashboard(db: Session, prompt: str = "", focus_table: Optional[str] = None) -> Dict[str, Any]:
    """
    Main AI Dashboard Generator:
    1. Extracts deep multi-table warehouse profile.
    2. Calls Gemini API (if available) or OpenAI API (if available) with strict schema prompting.
    3. Seamlessly falls back to Built-in Semantic AI Engine.
    """
    profile = extract_warehouse_deep_profile(db, focus_table)
    if not profile.get("tables"):
        return {
            "title": "Empty Warehouse",
            "subtitle": "No data available",
            "executive_summary": "No cleaned datasets found. Please upload one or more CSV files in the 'Upload & Clean' tab.",
            "key_findings": [],
            "kpis": [],
            "charts": [],
            "recommendations": [],
            "provider": "DataForge Engine",
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    prompt_summary = f"""User Request / Focus: {prompt or 'Comprehensive Executive Overview'}
Warehouse Metadata:
- Total Tables: {len(profile['tables'])} ({', '.join(profile['table_names'])})
- Total Rows: {profile['total_rows']:,}
- Star Schema Relationships: {len(profile['relationships'])} detected
Table Details:
{json.dumps(profile['tables'], indent=2, default=str)}
"""

    # 1. Try Gemini
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            full_prompt = f"""You are an executive BI data architect. Based on the warehouse profile below, generate a complete executive dashboard JSON specification.
Include:
- title: string
- subtitle: string
- executive_summary: 2-3 paragraph string with business insights
- key_findings: array of 4-5 bullet strings
- kpis: array of 3-4 objects {{ id, label, value, formatted_value, subtitle, trend: 'up'|'down'|'neutral', badge, icon: 'dollar'|'activity'|'trending-up'|'layers'|'award' }}
- charts: array of 3-4 objects {{ id, title, description, chart_type: 'area'|'bar'|'donut'|'rankings', data: [ {{ label, value }} ], x_label, y_label, color }}
- recommendations: array of 3-4 strategic business actions

Warehouse Profile:
{prompt_summary}

Respond ONLY with valid JSON. No markdown code blocks.
"""
            resp = model.generate_content(full_prompt)
            text_out = resp.text.strip()
            text_out = re.sub(r'^```json\s*', '', text_out)
            text_out = re.sub(r'\s*```$', '', text_out)
            parsed = json.loads(text_out)
            parsed["provider"] = "Gemini 1.5 Flash"
            parsed["generated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            return parsed
        except Exception:
            pass

    # 2. Try OpenAI
    if openai_key:
        try:
            import urllib.request
            req_data = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an executive BI architect. Return a complete executive dashboard JSON with title, subtitle, executive_summary, key_findings, kpis, charts, and recommendations based on the warehouse profile."
                    },
                    {"role": "user", "content": prompt_summary}
                ],
                "response_format": {"type": "json_object"}
            }
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                data=json.dumps(req_data).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                parsed = json.loads(res_body["choices"][0]["message"]["content"])
                parsed["provider"] = "GPT-4o Mini"
                parsed["generated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
                return parsed
        except Exception:
            pass

    # 3. High-Fidelity Built-in Engine
    return build_semantic_rule_dashboard(profile, prompt)


def generate_standalone_dashboard_html(dashboard: Dict[str, Any]) -> str:
    """
    Renders an interactive, self-contained standalone HTML report file:
    - Pure offline-capable (all CSS and SVG rendering logic embedded)
    - Modern SaaS aesthetic with executive cards, charts, and KPI widgets
    - Interactive SVG tooltips & print-to-PDF formatting
    """
    title = dashboard.get("title", "DataForge AI Executive Dashboard")
    subtitle = dashboard.get("subtitle", "")
    summary = dashboard.get("executive_summary", "")
    findings = dashboard.get("key_findings", [])
    kpis = dashboard.get("kpis", [])
    charts = dashboard.get("charts", [])
    recommendations = dashboard.get("recommendations", [])
    provider = dashboard.get("provider", "DataForge AI")
    gen_time = dashboard.get("generated_at", time.strftime("%Y-%m-%d %H:%M:%S"))

    # Render KPI Cards HTML
    kpis_html = ""
    for k in kpis:
        trend_icon = "↗" if k.get("trend") == "up" else ("↘" if k.get("trend") == "down" else "→")
        trend_class = "trend-up" if k.get("trend") == "up" else ("trend-down" if k.get("trend") == "down" else "trend-neutral")
        kpis_html += f"""
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">{k.get('label', '')}</span>
            <span class="kpi-badge">{k.get('badge', 'Metric')}</span>
          </div>
          <div class="kpi-value">{k.get('formatted_value', k.get('value', '0'))}</div>
          <div class="kpi-bottom">
            <span class="kpi-trend {trend_class}">{trend_icon}</span>
            <span class="kpi-sub">{k.get('subtitle', '')}</span>
          </div>
        </div>
        """

    # Render Charts HTML with embedded SVGs
    charts_html = ""
    for idx, chart in enumerate(charts):
        c_type = chart.get("chart_type", "bar")
        c_title = chart.get("title", f"Chart {idx+1}")
        c_desc = chart.get("description", "")
        data = chart.get("data", [])

        chart_body = ""
        if c_type in ["area", "line"] and len(data) > 1:
            # SVG Area / Line
            vals = [float(d.get("value", 0)) for d in data]
            max_v = max(vals) if vals and max(vals) > 0 else 1
            w, h = 600, 220
            pad_l, pad_r, pad_t, pad_b = 40, 20, 20, 40
            usable_w = w - pad_l - pad_r
            usable_h = h - pad_t - pad_b

            pts = []
            circles = ""
            labels_svg = ""
            for i, d in enumerate(data):
                x = pad_l + (i / max(len(data) - 1, 1)) * usable_w
                norm = float(d.get("value", 0)) / max_v
                y = h - pad_b - norm * usable_h
                pts.append(f"{x:.1f},{y:.1f}")
                val_fmt = format_currency_or_num(d.get('value', 0))
                lbl = str(d.get("label", ""))
                circles += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" class="chart-point" data-tip="{lbl}: {val_fmt}" />'
                if len(data) <= 12 or i % max(len(data)//6, 1) == 0:
                    labels_svg += f'<text x="{x:.1f}" y="{h - 15}" text-anchor="middle" class="axis-label">{lbl}</text>'

            path_d = f"M {pts[0]} " + " ".join([f"L {p}" for p in pts[1:]])
            area_d = f"{path_d} L {pad_l + usable_w:.1f},{h - pad_b:.1f} L {pad_l:.1f},{h - pad_b:.1f} Z"

            chart_body = f"""
            <svg viewBox="0 0 {w} {h}" class="svg-chart">
              <defs>
                <linearGradient id="grad-{idx}" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              <line x1="{pad_l}" y1="{h-pad_b}" x2="{w-pad_r}" y2="{h-pad_b}" class="grid-line"/>
              <path d="{area_d}" fill="url(#grad-{idx})" />
              <path d="{path_d}" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round"/>
              {circles}
              {labels_svg}
            </svg>
            """

        elif c_type in ["donut", "pie"]:
            # Clean HTML Progress / Segment List
            total_v = sum(float(d.get("value", 0)) for d in data) or 1
            palette = ["#4f46e5", "#0284c7", "#059669", "#d97706", "#e11d48", "#7c3aed"]
            bars = ""
            for i, d in enumerate(data[:6]):
                val = float(d.get("value", 0))
                pct = round((val / total_v) * 100, 1)
                color = palette[i % len(palette)]
                bars += f"""
                <div class="distribution-row">
                  <div class="dist-meta">
                    <span class="dist-label"><span class="dot" style="background:{color}"></span>{d.get('label', '')}</span>
                    <span class="dist-val">{val:,.0f} ({pct}%)</span>
                  </div>
                  <div class="progress-bg">
                    <div class="progress-fill" style="width: {pct}%; background: {color};"></div>
                  </div>
                </div>
                """
            chart_body = f'<div class="donut-fallback">{bars}</div>'

        else:
            # Vertical Bar or Rankings
            vals = [float(d.get("value", 0)) for d in data]
            max_v = max(vals) if vals and max(vals) > 0 else 1
            bar_items = ""
            for i, d in enumerate(data[:10]):
                val = float(d.get("value", 0))
                pct = round((val / max_v) * 100, 1)
                val_fmt = format_currency_or_num(val)
                bar_items += f"""
                <div class="rank-row">
                  <span class="rank-idx">#{i+1}</span>
                  <span class="rank-name">{d.get('label', '')}</span>
                  <div class="rank-bar-wrap">
                    <div class="rank-bar-fill" style="width: {pct}%;"></div>
                  </div>
                  <span class="rank-num">{val_fmt}</span>
                </div>
                """
            chart_body = f'<div class="rank-container">{bar_items}</div>'

        charts_html += f"""
        <div class="chart-card">
          <div class="chart-head">
            <h3 class="chart-title">{c_title}</h3>
            <p class="chart-desc">{c_desc}</p>
          </div>
          <div class="chart-body">
            {chart_body}
          </div>
        </div>
        """

    # Render Findings List
    findings_html = "".join([f"<li><span class='bullet-icon'>✔</span><span>{f}</span></li>" for f in findings])
    recommendations_html = "".join([f"<li><span class='rec-icon'>💡</span><span>{r}</span></li>" for r in recommendations])

    # Assemble Complete Interactive HTML
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — DataForge AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {{
      --primary: #4f46e5;
      --primary-dark: #4338ca;
      --primary-light: #e0e7ff;
      --surface: #ffffff;
      --bg: #f8fafc;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --success: #059669;
      --radius: 12px;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px 24px;
    }}
    .container {{
      max-width: 1200px;
      margin: 0 auto;
    }}
    /* Header */
    .header {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px 32px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }}
    .brand-tag {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--primary);
      background: var(--primary-light);
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }}
    .title {{
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text);
      margin-bottom: 4px;
    }}
    .subtitle {{
      font-size: 14px;
      color: var(--text-muted);
    }}
    .actions {{
      display: flex;
      gap: 12px;
    }}
    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      transition: all 0.2s;
    }}
    .btn:hover {{
      background: #f1f5f9;
      border-color: #cbd5e1;
    }}
    .btn-primary {{
      background: var(--primary);
      border-color: var(--primary);
      color: #ffffff;
    }}
    .btn-primary:hover {{
      background: var(--primary-dark);
    }}

    /* KPIs */
    .kpi-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }}
    .kpi-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 22px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }}
    .kpi-card::before {{
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--primary), #0284c7);
    }}
    .kpi-top {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }}
    .kpi-label {{
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }}
    .kpi-badge {{
      font-size: 11px;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 8px;
      border-radius: 6px;
    }}
    .kpi-value {{
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text);
      margin-bottom: 8px;
    }}
    .kpi-bottom {{
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }}
    .kpi-trend {{
      font-weight: 700;
    }}
    .trend-up {{ color: var(--success); }}
    .trend-down {{ color: #e11d48; }}
    .trend-neutral {{ color: var(--text-muted); }}
    .kpi-sub {{ color: var(--text-muted); }}

    /* Executive Briefing */
    .briefing-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
    }}
    .briefing-card h2 {{
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .briefing-text {{
      font-size: 15px;
      color: #334155;
      line-height: 1.6;
      margin-bottom: 20px;
    }}
    .briefing-split {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }}
    @media (max-width: 768px) {{
      .briefing-split {{ grid-template-columns: 1fr; }}
    }}
    .split-col h4 {{
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      margin-bottom: 12px;
    }}
    .list-unstyled {{
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}
    .list-unstyled li {{
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 14px;
      color: #334155;
    }}
    .bullet-icon {{ color: var(--primary); font-weight: bold; }}
    .rec-icon {{ font-size: 16px; }}

    /* Charts Grid */
    .charts-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }}
    @media (max-width: 600px) {{
      .charts-grid {{ grid-template-columns: 1fr; }}
    }}
    .chart-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow);
    }}
    .chart-head {{
      margin-bottom: 18px;
    }}
    .chart-title {{
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 4px;
    }}
    .chart-desc {{
      font-size: 13px;
      color: var(--text-muted);
    }}
    .chart-body {{
      width: 100%;
    }}

    /* SVG Chart */
    .svg-chart {{
      width: 100%;
      height: auto;
      overflow: visible;
    }}
    .grid-line {{ stroke: var(--border); stroke-dasharray: 4 4; }}
    .axis-label {{ font-size: 11px; fill: var(--text-muted); font-weight: 500; }}
    .chart-point {{
      fill: #ffffff;
      stroke: var(--primary);
      stroke-width: 2.5;
      cursor: pointer;
      transition: r 0.2s, stroke-width 0.2s;
    }}
    .chart-point:hover {{
      r: 6;
      stroke: #0284c7;
    }}

    /* Distribution Progress */
    .distribution-row {{
      margin-bottom: 14px;
    }}
    .dist-meta {{
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
    }}
    .dist-label {{ display: flex; align-items: center; gap: 8px; color: var(--text); }}
    .dist-val {{ color: var(--text-muted); }}
    .dot {{ width: 10px; height: 10px; border-radius: 50%; display: inline-block; }}
    .progress-bg {{
      background: #f1f5f9;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
    }}
    .progress-fill {{
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease;
    }}

    /* Rankings Table */
    .rank-container {{
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}
    .rank-row {{
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }}
    .rank-idx {{
      font-weight: 700;
      color: var(--text-muted);
      width: 24px;
    }}
    .rank-name {{
      font-weight: 600;
      color: var(--text);
      width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .rank-bar-wrap {{
      flex: 1;
      background: #f1f5f9;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
    }}
    .rank-bar-fill {{
      height: 100%;
      background: #0284c7;
      border-radius: 4px;
    }}
    .rank-num {{
      font-weight: 700;
      color: var(--text);
      width: 70px;
      text-align: right;
    }}

    /* Footer */
    .footer {{
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
      padding: 24px 0 12px 0;
      border-top: 1px solid var(--border);
    }}

    /* Print Formatting */
    @media print {{
      body {{ background: #ffffff; padding: 0; }}
      .actions, .footer {{ display: none; }}
      .header, .kpi-card, .briefing-card, .chart-card {{
        box-shadow: none;
        border: 1px solid #cbd5e1;
        break-inside: avoid;
      }}
      .charts-grid {{ grid-template-columns: 1fr 1fr; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div>
        <div class="brand-tag">✨ {provider} Generated</div>
        <h1 class="title">{title}</h1>
        <p class="subtitle">{subtitle}</p>
      </div>
      <div class="actions">
        <button class="btn" onclick="window.print()">
          🖨️ Print / Save PDF
        </button>
      </div>
    </header>

    <!-- KPI Metric Cards -->
    <section class="kpi-grid">
      {kpis_html}
    </section>

    <!-- Executive Briefing & Actionable Findings -->
    <section class="briefing-card">
      <h2>📊 Executive Intelligence Briefing</h2>
      <p class="briefing-text">{summary}</p>
      <div class="briefing-split">
        <div class="split-col">
          <h4>Key Findings & Metrics</h4>
          <ul class="list-unstyled">
            {findings_html}
          </ul>
        </div>
        <div class="split-col">
          <h4>Strategic Recommendations</h4>
          <ul class="list-unstyled">
            {recommendations_html}
          </ul>
        </div>
      </div>
    </section>

    <!-- Charts Grid -->
    <section class="charts-grid">
      {charts_html}
    </section>

    <!-- Footer -->
    <footer class="footer">
      Generated automatically by <strong>DataForge AI</strong> • Analytical Warehouse Engine • {gen_time}
    </footer>
  </div>
</body>
</html>
"""
    return html
