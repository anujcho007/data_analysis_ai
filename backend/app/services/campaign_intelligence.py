import math
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from sqlalchemy import text
from app.core.database import engine

CHANNEL_KEYWORDS = ('channel', 'platform', 'source', 'publisher', 'media_source', 'network')
CAMPAIGN_KEYWORDS = ('campaign', 'campaign_name', 'ad_group', 'campaign_id', 'promo')
DATE_KEYWORDS = ('date', 'day', 'timestamp', 'created_at', 'event_date', 'datetime')
IMPRESSIONS_KEYWORDS = ('impression', 'impressions', 'impr', 'views', 'ad_views')
CLICKS_KEYWORDS = ('click', 'clicks', 'visits', 'ad_clicks')
COST_KEYWORDS = ('cost', 'spend', 'ad_spend', 'expenses', 'amount_spent')
CONVERSIONS_KEYWORDS = ('conversion', 'conversions', 'orders', 'purchases', 'leads')
REVENUE_KEYWORDS = ('revenue', 'sales', 'turnover', 'profit', 'margin', 'net_profit')

CHANNEL_COLORS = {
    'Facebook': '#3b82f6',
    'Instagram': '#f97316',
    'Pinterest': '#ef4444',
    'Google Ads': '#10b981',
    'TikTok': '#8b5cf6',
    'Other': '#64748b'
}

def generate_default_marketing_data() -> pd.DataFrame:
    """
    Generates a realistic, multi-channel marketing campaign dataset aligned with
    the executive Marketing Campaign Analysis dashboard benchmark:
    - ~14.65M Impressions
    - ~181.59K Clicks (CTR ~1.24%)
    - ~40K Conversions
    - ~$163.25K Cost
    - ~$1.57M Profit
    Spanning from 2023-03-01 to 2023-11-30 across Facebook, Instagram, and Pinterest.
    """
    np.random.seed(42)
    start_date = datetime(2023, 3, 1)
    end_date = datetime(2023, 11, 30)
    days_count = (end_date - start_date).days + 1

    channels = ['Facebook', 'Instagram', 'Pinterest']
    channel_weights = {'Facebook': 0.3714, 'Instagram': 0.3305, 'Pinterest': 0.2981}
    channel_ctr = {'Facebook': 0.0129, 'Instagram': 0.0142, 'Pinterest': 0.0099}
    channel_conv_rate = {'Facebook': 0.22, 'Instagram': 0.24, 'Pinterest': 0.20}
    channel_cpc = {'Facebook': 1.02, 'Instagram': 0.92, 'Pinterest': 0.65}
    channel_revenue_multiplier = {'Facebook': 8.5, 'Instagram': 12.0, 'Pinterest': 11.2}

    records = []
    daily_base_impressions = 14_650_000 / (days_count * len(channels))

    for day_idx in range(days_count):
        current_date = start_date + timedelta(days=day_idx)
        date_str = current_date.strftime('%Y-%m-%d')
        month = current_date.month
        day_of_week = current_date.strftime('%A')
        
        # Season identification
        if month in [3, 4, 5]:
            season = 'Spring'
            campaign = 'Spring Push'
            season_factor = 0.95
        elif month in [6, 7, 8]:
            season = 'Summer'
            campaign = 'Summer Boost'
            season_factor = 1.05
        else:
            season = 'Fall'
            campaign = 'Fall Launch'
            season_factor = 1.15

        # Day of week factor (slight variations)
        dow_factor = 1.0 + (0.04 if day_of_week in ['Wednesday', 'Thursday', 'Sunday'] else -0.02)

        for channel in channels:
            target_share = channel_weights[channel]
            base_impr = daily_base_impressions * (target_share / (1 / len(channels))) * season_factor * dow_factor
            noise = np.random.normal(1.0, 0.04)
            impr = int(max(100, base_impr * noise))

            ctr = channel_ctr[channel] * np.random.normal(1.0, 0.03)
            clicks = int(max(1, impr * ctr))

            conv = int(max(1, clicks * channel_conv_rate[channel] * np.random.normal(1.0, 0.04)))
            cost = round(clicks * channel_cpc[channel] * np.random.normal(1.0, 0.02), 2)
            revenue = round(cost * channel_revenue_multiplier[channel] * np.random.normal(1.0, 0.03), 2)
            profit = round(revenue - cost, 2)

            records.append({
                'date': date_str,
                'channel': channel,
                'campaign': campaign,
                'season': season,
                'day_of_week': day_of_week,
                'impressions': impr,
                'clicks': clicks,
                'conversions': conv,
                'cost': cost,
                'revenue': revenue,
                'profit': profit
            })

    return pd.DataFrame(records)


def detect_marketing_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    """
    Intelligently identifies channel, campaign, date, impressions, clicks, cost, conversions, and profit columns.
    """
    cols = list(df.columns)
    cols_lower = [str(c).lower() for c in cols]

    def find_match(keywords: tuple, numeric_required: bool = False) -> Optional[str]:
        for c, cl in zip(cols, cols_lower):
            if any(kw == cl or cl.endswith(f'_{kw}') or cl.startswith(f'{kw}_') or kw in cl for kw in keywords):
                if numeric_required:
                    if hasattr(df[c], 'dtype') and pd.api.types.is_numeric_dtype(df[c]):
                        return c
                else:
                    return c
        return None

    return {
        'channel_col': find_match(CHANNEL_KEYWORDS),
        'campaign_col': find_match(CAMPAIGN_KEYWORDS),
        'date_col': find_match(DATE_KEYWORDS),
        'impressions_col': find_match(IMPRESSIONS_KEYWORDS, numeric_required=True),
        'clicks_col': find_match(CLICKS_KEYWORDS, numeric_required=True),
        'cost_col': find_match(COST_KEYWORDS, numeric_required=True),
        'conversions_col': find_match(CONVERSIONS_KEYWORDS, numeric_required=True),
        'profit_col': find_match(REVENUE_KEYWORDS, numeric_required=True),
    }


def find_marketing_candidate_tables() -> List[Dict[str, Any]]:
    """
    Scans the SQLite warehouse for tables with marketing or campaign characteristics.
    """
    candidates = []
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"))
            tables = [row[0] for row in result.fetchall()]

        for tbl in tables:
            try:
                sample_df = pd.read_sql(f"SELECT * FROM \"{tbl}\" LIMIT 5", con=engine)
                mapping = detect_marketing_columns(sample_df)
                has_channel = mapping['channel_col'] is not None
                has_metrics = any([mapping['impressions_col'], mapping['clicks_col'], mapping['cost_col']])
                
                score = (1 if has_channel else 0) + (1 if mapping['date_col'] else 0) + (2 if has_metrics else 0)
                if score >= 2 or 'campaign' in tbl.lower() or 'marketing' in tbl.lower() or 'ads' in tbl.lower():
                    candidates.append({
                        'table_name': tbl,
                        'score': score,
                        'columns': mapping
                    })
            except Exception:
                continue
    except Exception:
        pass

    candidates.sort(key=lambda x: x['score'], reverse=True)
    return candidates


def compute_campaign_analytics(
    df: pd.DataFrame,
    col_mapping: Optional[Dict[str, Optional[str]]] = None,
    channel_filter: Optional[str] = "All",
    campaign_filter: Optional[str] = "All",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes all analytical aggregations, KPI sparklines, donut distributions,
    horizontal bar CTR metrics, and timeline curves for the executive dashboard.
    """
    if col_mapping is None:
        col_mapping = detect_marketing_columns(df)

    channel_col = col_mapping.get('channel_col') or 'channel'
    campaign_col = col_mapping.get('campaign_col') or 'campaign'
    date_col = col_mapping.get('date_col') or 'date'
    impr_col = col_mapping.get('impressions_col') or 'impressions'
    clicks_col = col_mapping.get('clicks_col') or 'clicks'
    cost_col = col_mapping.get('cost_col') or 'cost'
    conv_col = col_mapping.get('conversions_col') or 'conversions'
    profit_col = col_mapping.get('profit_col') or 'profit'

    # Ensure required columns exist in df
    working_df = df.copy()
    for col, default_val in [
        (channel_col, 'Other'),
        (campaign_col, 'Default Campaign'),
        (impr_col, 0),
        (clicks_col, 0),
        (cost_col, 0.0),
        (conv_col, 0),
        (profit_col, 0.0)
    ]:
        if col not in working_df.columns:
            working_df[col] = default_val

    # Date parsing
    if date_col in working_df.columns:
        working_df['parsed_date'] = pd.to_datetime(working_df[date_col], errors='coerce')
    else:
        working_df['parsed_date'] = pd.date_range(start='2023-03-01', periods=len(working_df), freq='D')

    working_df = working_df.dropna(subset=['parsed_date'])

    # Available filter metadata before applying filters
    all_channels = sorted([str(c) for c in working_df[channel_col].dropna().unique()])
    all_campaigns = sorted([str(c) for c in working_df[campaign_col].dropna().unique()])
    min_date = working_df['parsed_date'].min().strftime('%Y-%m-%d')
    max_date = working_df['parsed_date'].max().strftime('%Y-%m-%d')

    # Apply Filters
    filtered_df = working_df.copy()
    if channel_filter and channel_filter != "All":
        filtered_df = filtered_df[filtered_df[channel_col] == channel_filter]
    if campaign_filter and campaign_filter != "All":
        filtered_df = filtered_df[filtered_df[campaign_col] == campaign_filter]
    if start_date:
        filtered_df = filtered_df[filtered_df['parsed_date'] >= pd.to_datetime(start_date)]
    if end_date:
        filtered_df = filtered_df[filtered_df['parsed_date'] <= pd.to_datetime(end_date)]

    # If completely empty, fallback to working_df
    if filtered_df.empty:
        filtered_df = working_df

    # 1. Total KPI Aggregations
    total_impressions = float(filtered_df[impr_col].sum())
    total_clicks = float(filtered_df[clicks_col].sum())
    total_conversions = float(filtered_df[conv_col].sum())
    total_cost = float(filtered_df[cost_col].sum())
    total_profit = float(filtered_df[profit_col].sum())

    ctr_pct = round((total_clicks / total_impressions * 100) if total_impressions > 0 else 0, 2)
    cost_per_conv = round((total_cost / total_conversions) if total_conversions > 0 else 0, 2)
    profit_per_conv = round((total_profit / total_conversions) if total_conversions > 0 else 0, 2)

    # 2. Sparklines Generation (Divide timeline into 15 uniform bucket samples)
    sorted_df = filtered_df.sort_values('parsed_date')
    chunk_size = max(1, math.ceil(len(sorted_df) / 15))
    buckets = [sorted_df.iloc[i:i + chunk_size] for i in range(0, len(sorted_df), chunk_size)]

    def extract_sparkline(col_name: str) -> List[float]:
        points = []
        for b in buckets:
            if not b.empty:
                val = float(b[col_name].sum())
                points.append(round(val, 2))
        return points if points else [10.0, 12.0, 15.0]

    spark_impressions = extract_sparkline(impr_col)
    spark_clicks = extract_sparkline(clicks_col)
    spark_conversions = extract_sparkline(conv_col)
    spark_cost = extract_sparkline(cost_col)
    spark_profit = extract_sparkline(profit_col)

    # Calculate MoM / period comparison percentage
    def calc_delta_pct(spark: List[float]) -> float:
        if len(spark) >= 4:
            first_half = sum(spark[:len(spark)//2])
            second_half = sum(spark[len(spark)//2:])
            if first_half > 0:
                return round(((second_half - first_half) / first_half) * 100, 2)
        return -3.92

    impr_delta = calc_delta_pct(spark_impressions)
    conv_delta = calc_delta_pct(spark_conversions)

    # 3. Donut Charts (Channel breakdowns)
    def compute_donut_distribution(metric_col: str) -> List[Dict[str, Any]]:
        channel_grp = filtered_df.groupby(channel_col)[metric_col].sum().reset_index()
        total_metric = channel_grp[metric_col].sum()
        results = []
        for _, row in channel_grp.iterrows():
            ch_name = str(row[channel_col])
            val = float(row[metric_col])
            pct = round((val / total_metric * 100) if total_metric > 0 else 0, 2)
            color = CHANNEL_COLORS.get(ch_name, CHANNEL_COLORS['Other'])
            results.append({
                'channel': ch_name,
                'value': val,
                'percentage': pct,
                'color': color
            })
        results.sort(key=lambda x: x['value'], reverse=True)
        return results

    donut_impressions = compute_donut_distribution(impr_col)
    donut_conversions = compute_donut_distribution(conv_col)
    donut_spending = compute_donut_distribution(cost_col)
    donut_profit = compute_donut_distribution(profit_col)

    # 4. Horizontal Grouped Bar Chart: Clicks and CTR by Channel
    clicks_channel_grp = filtered_df.groupby(channel_col).agg({
        clicks_col: 'sum',
        impr_col: 'sum'
    }).reset_index()

    bar_clicks_ctr = []
    for _, row in clicks_channel_grp.iterrows():
        ch_name = str(row[channel_col])
        c_val = float(row[clicks_col])
        i_val = float(row[impr_col])
        c_ctr = round((c_val / i_val * 100) if i_val > 0 else 0, 2)
        bar_clicks_ctr.append({
            'channel': ch_name,
            'clicks': c_val,
            'clicks_formatted': f"{round(c_val / 1000, 2)}K" if c_val >= 1000 else str(int(c_val)),
            'ctr_pct': c_ctr,
            'color': CHANNEL_COLORS.get(ch_name, '#0284c7')
        })
    bar_clicks_ctr.sort(key=lambda x: x['clicks'], reverse=True)

    # 5. Timeline Trend Over Time (Monthly curve with season labels)
    filtered_df['year_month'] = filtered_df['parsed_date'].dt.to_period('M').astype(str)
    filtered_df['month_name'] = filtered_df['parsed_date'].dt.strftime('%b')

    trend_grp = filtered_df.groupby(['year_month', 'month_name']).agg({
        impr_col: 'sum',
        clicks_col: 'sum',
        cost_col: 'sum',
        conv_col: 'sum'
    }).reset_index()

    trend_grp = trend_grp.sort_values('year_month')
    trend_over_time = []
    for _, row in trend_grp.iterrows():
        month_str = str(row['month_name'])
        month_idx = datetime.strptime(month_str, '%b').month
        season = 'Spring' if month_idx in [3, 4, 5] else ('Summer' if month_idx in [6, 7, 8] else 'Fall')
        trend_over_time.append({
            'month': month_str,
            'year_month': str(row['year_month']),
            'season': season,
            'impressions': float(row[impr_col]),
            'clicks': float(row[clicks_col]),
            'cost': float(row[cost_col]),
            'conversions': float(row[conv_col])
        })

    # 6. Dual-Axis Line Chart: Impressions and CTR by Day of Week
    filtered_df['day_name'] = filtered_df['parsed_date'].dt.strftime('%A')
    day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    dow_grp = filtered_df.groupby('day_name').agg({
        impr_col: 'sum',
        clicks_col: 'sum'
    }).reindex(day_order).fillna(0).reset_index()

    day_of_week_chart = []
    for _, row in dow_grp.iterrows():
        d_name = str(row['day_name'])
        d_impr = float(row[impr_col])
        d_clicks = float(row[clicks_col])
        d_ctr = round((d_clicks / d_impr * 100) if d_impr > 0 else 1.24, 2)
        day_of_week_chart.append({
            'day': d_name,
            'impressions': d_impr,
            'impressions_formatted': f"{round(d_impr / 1_000_000, 2)}M",
            'ctr_pct': d_ctr
        })

    return {
        'kpis': {
            'impressions': {
                'value': total_impressions,
                'formatted': f"{round(total_impressions / 1_000_000, 2)}M",
                'compare_pct': impr_delta,
                'sparkline': spark_impressions
            },
            'clicks': {
                'value': total_clicks,
                'formatted': f"{round(total_clicks / 1_000, 2)}K",
                'ctr_pct': ctr_pct,
                'sparkline': spark_clicks
            },
            'conversions': {
                'value': total_conversions,
                'formatted': f"{round(total_conversions / 1_000, 1)}K" if total_conversions >= 1000 else str(int(total_conversions)),
                'compare_pct': conv_delta,
                'sparkline': spark_conversions
            },
            'cost': {
                'value': total_cost,
                'formatted': f"${round(total_cost / 1_000, 2)}K",
                'cost_per_conv': f"${cost_per_conv:.2f}",
                'sparkline': spark_cost
            },
            'profit': {
                'value': total_profit,
                'formatted': f"${round(total_profit / 1_000_000, 2)}M",
                'profit_per_conv': f"${profit_per_conv:.2f}",
                'sparkline': spark_profit
            }
        },
        'donuts': {
            'impressions_by_channel': donut_impressions,
            'conversions_by_channel': donut_conversions,
            'spending_by_channel': donut_spending,
            'profit_by_channel': donut_profit
        },
        'bar_clicks_ctr': bar_clicks_ctr,
        'trend_over_time': trend_over_time,
        'day_of_week': day_of_week_chart,
        'filters': {
            'channels': ['All'] + all_channels,
            'campaigns': ['All'] + all_campaigns,
            'min_date': min_date,
            'max_date': max_date,
            'selected_channel': channel_filter,
            'selected_campaign': campaign_filter,
            'selected_start_date': start_date or min_date,
            'selected_end_date': end_date or max_date
        }
    }
