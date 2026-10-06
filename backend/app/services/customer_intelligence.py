import re
import math
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

CUSTOMER_CANDIDATE_SUFFIXES = ('customer_id', 'user_id', 'client_id', 'buyer_id', 'account_id', 'member_id')
DATE_CANDIDATE_SUFFIXES = ('_date', '_timestamp', 'date', 'datetime', 'created_at', 'order_date', 'timestamp')
MONETARY_CANDIDATE_KEYWORDS = ('sales_amount', 'amount', 'total', 'revenue', 'price', 'subtotal', 'sales_qty', 'spend')

def detect_customer_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    """
    Intelligently identifies customer ID, transaction date, and monetary revenue columns.
    """
    cols = list(df.columns)
    cols_lower = [str(c).lower() for c in cols]

    # 1. Customer Column
    customer_col = None
    for c, cl in zip(cols, cols_lower):
        if any(cl.endswith(sfx) or cl == sfx for sfx in CUSTOMER_CANDIDATE_SUFFIXES):
            customer_col = c
            break
    if not customer_col:
        for c, cl in zip(cols, cols_lower):
            if any(kw in cl for kw in ['customer', 'user', 'client', 'email']):
                customer_col = c
                break

    # 2. Date Column
    date_col = None
    for c, cl in zip(cols, cols_lower):
        if any(cl.endswith(sfx) or cl == sfx for sfx in DATE_CANDIDATE_SUFFIXES):
            date_col = c
            break

    # 3. Monetary / Revenue Column
    monetary_col = None
    for c, cl in zip(cols, cols_lower):
        if any(kw in cl for kw in MONETARY_CANDIDATE_KEYWORDS):
            # Verify numeric
            if hasattr(df[c], 'dtype') and pd.api.types.is_numeric_dtype(df[c]):
                monetary_col = c
                break
    if not monetary_col:
        # Fallback to any positive numeric column
        for c in cols:
            if hasattr(df[c], 'dtype') and pd.api.types.is_numeric_dtype(df[c]) and c != customer_col:
                monetary_col = c
                break

    return {
        "customer_column": customer_col,
        "date_column": date_col,
        "monetary_column": monetary_col
    }


def assign_rfm_segment(r: int, f: int, m: int) -> Tuple[str, str, str]:
    """
    Classifies a customer into a strategic RFM segment based on (R, F, M) quintiles (1-5).
    Returns (segment_name, badge_color, strategic_recommendation)
    """
    fm_avg = (f + m) / 2.0

    if r >= 4 and f >= 4 and m >= 4:
        return (
            "Champions",
            "#10b981", # Emerald
            "Reward their loyalty. Offer early access to flagship products and invite into VIP advocate program."
        )
    elif r >= 3 and f >= 3 and m >= 3:
        return (
            "Loyal Regulars",
            "#0284c7", # Sky
            "Upsell higher-value products. Encourage brand reviews and referrals with tier perks."
        )
    elif r >= 4 and f <= 3 and m >= 2:
        return (
            "Potential Loyalists",
            "#8b5cf6", # Purple
            "Engage with loyalty rewards, personalized recommendations, and limited-time bundles."
        )
    elif r >= 4 and f == 1:
        return (
            "New Customers",
            "#06b6d4", # Cyan
            "Provide welcoming onboarding experience, check-in emails, and start building relationship."
        )
    elif r == 3 and f == 1:
        return (
            "Promising",
            "#3b82f6", # Blue
            "Build brand awareness, send product guides, and offer modest discount incentives on next order."
        )
    elif r == 3 and (f >= 2 or m >= 2):
        return (
            "Needs Attention",
            "#eab308", # Amber
            "Re-activate with tailored promotions and time-sensitive product drop notifications."
        )
    elif r <= 2 and (f >= 4 and m >= 4):
        return (
            "Can't Lose Them",
            "#f97316", # Orange
            "Win them back immediately! Personalized CEO/concierge outreach and high-value incentives."
        )
    elif r <= 2 and (f >= 2 and m >= 2):
        return (
            "At-Risk",
            "#ef4444", # Red
            "Send personalized win-back re-engagement campaign, surveys on satisfaction, and renewal discounts."
        )
    elif r <= 2 and f <= 2 and m >= 2:
        return (
            "Hibernating",
            "#64748b", # Slate
            "Offer relevant discounts and highlight new product improvements since last visit."
        )
    else:
        return (
            "Lost / Churned",
            "#94a3b8", # Muted gray
            "Low-cost automated re-activation drip campaign; otherwise focus marketing spend elsewhere."
        )


def compute_rfm_segmentation(
    df: pd.DataFrame,
    customer_col: str,
    date_col: str,
    monetary_col: str,
    reference_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes full customer RFM behavioral segmentation and value analysis.
    """
    if df.empty:
        raise ValueError("Provided dataset is empty.")

    work_df = df[[customer_col, date_col, monetary_col]].copy()
    work_df = work_df.dropna(subset=[customer_col, date_col])

    # Convert date
    work_df['parsed_date'] = pd.to_datetime(work_df[date_col], errors='coerce')
    work_df = work_df.dropna(subset=['parsed_date'])

    # Convert monetary
    work_df['clean_monetary'] = pd.to_numeric(work_df[monetary_col], errors='coerce').fillna(0.0)

    if work_df.empty:
        raise ValueError("No valid customer transactions could be parsed.")

    # Reference Snapshot Date
    if reference_date_str:
        ref_date = pd.to_datetime(reference_date_str)
    else:
        ref_date = work_df['parsed_date'].max() + pd.Timedelta(days=1)

    # Aggregate by customer
    grouped = work_df.groupby(customer_col).agg(
        last_purchase=('parsed_date', 'max'),
        first_purchase=('parsed_date', 'min'),
        frequency=('parsed_date', 'count'),
        monetary=('clean_monetary', 'sum')
    ).reset_index()

    # Recency in days
    grouped['recency'] = (ref_date - grouped['last_purchase']).dt.days.clip(lower=0)
    grouped['avg_order_value'] = (grouped['monetary'] / grouped['frequency']).round(2)

    total_customers = len(grouped)
    if total_customers < 3:
        raise ValueError("RFM analysis requires at least 3 distinct customer profiles.")

    # Quintile ranking (1 to 5)
    # Recency: Lower is better -> invert rank so highest score (5) goes to lowest recency days
    grouped['r_score'] = pd.qcut(grouped['recency'].rank(method='first', ascending=False), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    grouped['f_score'] = pd.qcut(grouped['frequency'].rank(method='first', ascending=True), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    grouped['m_score'] = pd.qcut(grouped['monetary'].rank(method='first', ascending=True), 5, labels=[1, 2, 3, 4, 5]).astype(int)

    # Assign segments
    segments = []
    badge_colors = []
    recommendations = []

    for _, row in grouped.iterrows():
        seg, color, rec = assign_rfm_segment(row['r_score'], row['f_score'], row['m_score'])
        segments.append(seg)
        badge_colors.append(color)
        recommendations.append(rec)

    grouped['segment'] = segments
    grouped['segment_color'] = badge_colors
    grouped['recommendation'] = recommendations
    grouped['rfm_score'] = grouped['r_score'].astype(str) + grouped['f_score'].astype(str) + grouped['m_score'].astype(str)

    # Segment aggregations
    seg_summary = []
    total_rev = float(grouped['monetary'].sum())

    for seg_name, group in grouped.groupby('segment'):
        c_count = len(group)
        s_rev = float(group['monetary'].sum())
        seg_summary.append({
            "segment": seg_name,
            "customer_count": c_count,
            "customer_share_pct": round((c_count / total_customers) * 100.0, 1),
            "revenue": round(s_rev, 2),
            "revenue_share_pct": round((s_rev / max(1.0, total_rev)) * 100.0, 1),
            "avg_recency_days": round(float(group['recency'].mean()), 1),
            "avg_frequency": round(float(group['frequency'].mean()), 1),
            "avg_monetary": round(float(group['monetary'].mean()), 2),
            "avg_order_value": round(float(group['avg_order_value'].mean()), 2),
            "color": group['segment_color'].iloc[0],
            "recommendation": group['recommendation'].iloc[0]
        })

    # Sort segments by revenue contribution descending
    seg_summary.sort(key=lambda s: s["revenue"], reverse=True)

    # Repeat purchase rate (customers with > 1 order)
    repeat_customers = int((grouped['frequency'] > 1).sum())
    repeat_rate_pct = round((repeat_customers / total_customers) * 100.0, 1)

    # Customer Profiles (top 150 ranked by monetary spend)
    top_profiles = grouped.sort_values(by='monetary', ascending=False).head(150)
    customer_list = []
    for _, r in top_profiles.iterrows():
        customer_list.append({
            "customer_id": str(r[customer_col]),
            "segment": r['segment'],
            "color": r['segment_color'],
            "rfm_score": r['rfm_score'],
            "recency_days": int(r['recency']),
            "frequency": int(r['frequency']),
            "total_spend": round(float(r['monetary']), 2),
            "avg_order_value": round(float(r['avg_order_value']), 2),
            "last_active": r['last_purchase'].strftime('%Y-%m-%d')
        })

    return {
        "total_customers": total_customers,
        "total_revenue": round(total_rev, 2),
        "avg_customer_value": round(total_rev / total_customers, 2),
        "repeat_purchase_rate_pct": repeat_rate_pct,
        "repeat_customer_count": repeat_customers,
        "avg_recency_days": round(float(grouped['recency'].mean()), 1),
        "avg_frequency": round(float(grouped['frequency'].mean()), 1),
        "snapshot_date": ref_date.strftime('%Y-%m-%d'),
        "segments": seg_summary,
        "customer_profiles": customer_list
    }


def compute_cohort_retention(
    df: pd.DataFrame,
    customer_col: str,
    date_col: str,
    max_periods: int = 12
) -> Dict[str, Any]:
    """
    Calculates monthly customer cohort retention matrix (Month 0 to Month 12).
    """
    work_df = df[[customer_col, date_col]].copy().dropna()
    work_df['date'] = pd.to_datetime(work_df[date_col], errors='coerce')
    work_df = work_df.dropna(subset=['date'])

    if work_df.empty:
        return {"cohorts": [], "periods": []}

    # Month Period
    work_df['order_period'] = work_df['date'].dt.to_period('M')

    # First purchase cohort
    work_df['cohort_group'] = work_df.groupby(customer_col)['order_period'].transform('min')

    # Group by cohort and period
    cohort_data = work_df.groupby(['cohort_group', 'order_period'])[customer_col].nunique().reset_index()
    cohort_data.rename(columns={customer_col: 'active_customers'}, inplace=True)

    # Compute period index (0, 1, 2...)
    cohort_data['period_index'] = (
        (cohort_data['order_period'].dt.year - cohort_data['cohort_group'].dt.year) * 12 +
        (cohort_data['order_period'].dt.month - cohort_data['cohort_group'].dt.month)
    )

    # Filter up to max_periods
    cohort_data = cohort_data[cohort_data['period_index'] <= max_periods]

    # Pivot into matrix
    matrix = cohort_data.pivot(index='cohort_group', columns='period_index', values='active_customers').fillna(0)
    cohort_sizes = matrix.iloc[:, 0].copy()

    # Retention %
    retention_matrix = matrix.divide(cohort_sizes, axis=0) * 100.0

    cohorts_res = []
    # Sort cohorts chronologically
    for cohort_period in sorted(matrix.index, reverse=True)[:10]:
        c_name = str(cohort_period)
        init_size = int(cohort_sizes.loc[cohort_period])
        ret_vals = []
        for p in range(max_periods + 1):
            if p in retention_matrix.columns and not pd.isna(retention_matrix.loc[cohort_period, p]):
                pct = round(float(retention_matrix.loc[cohort_period, p]), 1)
                ret_vals.append(pct)
            else:
                ret_vals.append(None)
        
        cohorts_res.append({
            "cohort": c_name,
            "cohort_size": init_size,
            "retention": ret_vals
        })

    periods_header = [f"M{i}" for i in range(max_periods + 1)]

    return {
        "cohorts": cohorts_res,
        "periods": periods_header
    }
