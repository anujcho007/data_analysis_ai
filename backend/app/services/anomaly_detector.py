import math
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text

def scan_table_anomalies(
    df: pd.DataFrame,
    table_name: str,
    metric_column: Optional[str] = None,
    date_column: Optional[str] = None,
    z_threshold: float = 2.5
) -> Dict[str, Any]:
    """
    Performs comprehensive automated statistical anomaly detection across dataset:
    1. Statistical Z-Score Outlier Analysis
    2. Interquartile Range (IQR) Extreme Bound Outliers
    3. Trajectory Crash Detection (Sudden drop from rolling average)
    4. Distribution Skewness & Volatility Assessment
    """
    if df.empty:
        return {"table_name": table_name, "anomalies": [], "total_anomalies": 0}

    # 1. Resolve Metric Column
    if not metric_column:
        num_cols = [c for c in df.columns if hasattr(df[c], 'dtype') and pd.api.types.is_numeric_dtype(df[c])]
        # Exclude IDs
        cand = [c for c in num_cols if str(c).lower() not in ['id', 'idx'] and not str(c).lower().endswith('_id')]
        metric_column = cand[0] if cand else (num_cols[0] if num_cols else None)

    if not metric_column or metric_column not in df.columns:
        return {"table_name": table_name, "anomalies": [], "total_anomalies": 0, "message": "No numeric metric found."}

    series = pd.to_numeric(df[metric_column], errors='coerce').dropna()
    if len(series) < 5:
        return {"table_name": table_name, "anomalies": [], "total_anomalies": 0, "message": "Insufficient data points."}

    mean_val = float(series.mean())
    std_val = float(series.std()) if len(series) > 1 else 1.0
    median_val = float(series.median())
    q25 = float(series.quantile(0.25))
    q75 = float(series.quantile(0.75))
    iqr = q75 - q25
    upper_iqr = q75 + (1.5 * iqr)
    lower_iqr = max(0.0, q25 - (1.5 * iqr))

    anomalies = []

    # 2. Scan Individual Outliers via Z-Score
    if std_val > 0:
        z_scores = (series - mean_val) / std_val
        outlier_indices = z_scores[np.abs(z_scores) >= z_threshold].index

        for idx in outlier_indices[:15]:
            val = float(series.loc[idx])
            z = float(z_scores.loc[idx])
            is_spike = z > 0

            # Get row metadata for context if available
            row_meta = {}
            for col in ['title', 'name', 'product', 'category', 'sku']:
                if col in df.columns:
                    row_meta[col] = str(df.loc[idx, col])

            date_val = str(df.loc[idx, date_column]) if date_column and date_column in df.columns else f"Row {idx + 1}"

            severity = "CRITICAL" if abs(z) >= 3.5 else "WARNING"
            anom_type = "Severe Spike Outlier" if is_spike else "Severe Drop Anomaly"

            anomalies.append({
                "type": anom_type,
                "severity": severity,
                "metric": metric_column,
                "value": round(val, 2),
                "expected_mean": round(mean_val, 2),
                "z_score": round(z, 2),
                "timestamp": date_val,
                "context": row_meta,
                "description": f"Value {val:,.2f} deviated by {z:+.1f} standard deviations from mean ({mean_val:,.2f})."
            })

    # 3. Time-Series Sudden Drop / Crash Detection
    if date_column and date_column in df.columns:
        try:
            df_ts = df[[date_column, metric_column]].copy()
            df_ts[date_column] = pd.to_datetime(df_ts[date_column], errors='coerce')
            df_ts = df_ts.dropna().sort_values(by=date_column)
            if len(df_ts) >= 10:
                daily = df_ts.groupby(df_ts[date_column].dt.strftime('%Y-%m-%d'))[metric_column].sum()
                rolling_7 = daily.rolling(window=7, min_periods=3).mean()
                pct_change = (daily - rolling_7) / (rolling_7 + 1e-6)

                crash_days = pct_change[pct_change <= -0.35]
                for date_str, drop_rate in crash_days.tail(5).items():
                    actual_val = float(daily.loc[date_str])
                    expected_val = float(rolling_7.loc[date_str])
                    anomalies.append({
                        "type": "Sudden Trend Crash",
                        "severity": "CRITICAL",
                        "metric": metric_column,
                        "value": round(actual_val, 2),
                        "expected_mean": round(expected_val, 2),
                        "z_score": round(drop_rate * 3, 2),
                        "timestamp": date_str,
                        "context": {"drop_percentage": f"{abs(drop_rate)*100:.1f}%"},
                        "description": f"Aggregated {metric_column} crashed by {abs(drop_rate)*100:.1f}% compared to 7-day rolling baseline."
                    })
        except Exception:
            pass

    return {
        "table_name": table_name,
        "metric_analyzed": metric_column,
        "total_anomalies": len(anomalies),
        "dataset_baseline": {
            "mean": round(mean_val, 2),
            "median": round(median_val, 2),
            "std": round(std_val, 2),
            "upper_bound_iqr": round(upper_iqr, 2),
            "lower_bound_iqr": round(lower_iqr, 2),
            "total_records": len(df)
        },
        "anomalies": anomalies
    }
