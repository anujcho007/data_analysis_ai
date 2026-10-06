import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.dataset import DatasetMetadata

def run_digital_twin_simulation(
    db: Session,
    table_name: str,
    metric_column: str,
    date_column: Optional[str] = None,
    price_change_pct: float = 0.0,       # e.g. +10% or -15%
    price_elasticity: float = -1.2,      # % change in quantity / % change in price
    marketing_multiplier: float = 1.0,   # 1.0 = baseline, 1.5 = +50% budget
    cost_inflation_pct: float = 0.0,     # e.g. +5% COGS increase
    churn_rate_pct: float = 0.0,         # e.g. +2% friction churn
    horizon_days: int = 60,
    mc_iterations: int = 100
) -> Dict[str, Any]:
    """
    Simulates business outcomes under adjustable economic levers and stochastic Monte Carlo sampling.
    """
    # Fetch base data
    clean_table = "".join(c for c in table_name if c.isalnum() or c == "_")
    sql = f'SELECT * FROM "{clean_table}" LIMIT 200000'
    raw_df = pd.read_sql_query(sql, con=db.connection())
    if raw_df.empty:
        raise ValueError(f"Table '{table_name}' has no records to simulate.")

    if metric_column not in raw_df.columns:
        raise ValueError(f"Metric column '{metric_column}' not found in table '{table_name}'.")

    # Clean numeric series
    series = pd.to_numeric(raw_df[metric_column], errors='coerce').dropna()
    if len(series) < 3:
        raise ValueError(f"Insufficient numeric observations in '{metric_column}'.")

    base_mean = float(series.mean())
    base_std = float(series.std()) if len(series) > 1 and series.std() > 0 else (base_mean * 0.1)
    base_total = float(series.sum())

    # 1. Calculate Demand / Volume Shift from Price & Marketing
    # Delta Q_price = Elasticity * (Price Change %)
    volume_price_factor = 1.0 + (price_elasticity * (price_change_pct / 100.0))
    # Diminishing returns on marketing spend: ln(multiplier) * sensitivity factor 0.25
    marketing_factor = 1.0 + (0.25 * math.log(max(0.1, marketing_multiplier)))
    # Churn drag
    retention_factor = 1.0 - (churn_rate_pct / 100.0)

    # Combined volume shift
    simulated_volume_factor = max(0.1, volume_price_factor * marketing_factor * retention_factor)
    
    # Unit price factor
    simulated_price_factor = 1.0 + (price_change_pct / 100.0)

    # Unit cost factor (assuming baseline gross margin ~40% for typical retail/food/SaaS)
    baseline_margin_pct = 40.0
    baseline_cogs_ratio = 0.60
    new_cogs_ratio = baseline_cogs_ratio * (1.0 + (cost_inflation_pct / 100.0))

    # Revenue shift factor = Volume factor * Price factor
    simulated_revenue_factor = simulated_volume_factor * simulated_price_factor
    simulated_gross_margin_pct = max(0.0, (1.0 - (new_cogs_ratio / simulated_price_factor))) * 100.0

    # 2. Time-Series Projection over Horizon Days
    days = list(range(1, horizon_days + 1))
    np.random.seed(42)

    # Baseline daily average
    daily_base = base_mean
    daily_std = base_std * 0.3

    baseline_trajectory = []
    simulated_trajectory = []
    p10_trajectory = []
    p90_trajectory = []

    # Stochastic path generator for Monte Carlo
    all_paths = np.zeros((mc_iterations, horizon_days))

    for day_idx in range(horizon_days):
        trend_drift = 1.0 + (0.001 * day_idx) # mild organic drift
        base_day_val = daily_base * trend_drift
        sim_day_mean = base_day_val * simulated_revenue_factor

        baseline_trajectory.append({
            "day": day_idx + 1,
            "baseline": round(base_day_val, 2),
            "simulated": round(sim_day_mean, 2)
        })

        # Run MC iterations for confidence bands
        day_draws = np.random.normal(loc=sim_day_mean, scale=daily_std * simulated_volume_factor, size=mc_iterations)
        all_paths[:, day_idx] = day_draws

    # Compute P10, P50, P90 across paths
    p10 = np.percentile(all_paths, 10, axis=0)
    p50 = np.percentile(all_paths, 50, axis=0)
    p90 = np.percentile(all_paths, 90, axis=0)

    for i in range(horizon_days):
        baseline_trajectory[i]["p10_pessimistic"] = round(float(max(0.0, p10[i])), 2)
        baseline_trajectory[i]["p90_optimistic"] = round(float(max(0.0, p90[i])), 2)

    # Aggregate Horizon Totals
    horizon_baseline_rev = sum(pt["baseline"] for pt in baseline_trajectory)
    horizon_simulated_rev = sum(pt["simulated"] for pt in baseline_trajectory)
    rev_delta = horizon_simulated_rev - horizon_baseline_rev
    rev_delta_pct = (rev_delta / horizon_baseline_rev) * 100.0 if horizon_baseline_rev > 0 else 0.0

    # Profit calculations
    baseline_profit = horizon_baseline_rev * (baseline_margin_pct / 100.0)
    simulated_profit = horizon_simulated_rev * (simulated_gross_margin_pct / 100.0)
    profit_delta = simulated_profit - baseline_profit
    profit_delta_pct = (profit_delta / baseline_profit) * 100.0 if baseline_profit > 0 else 0.0

    # Elasticity diagnostic
    if price_change_pct > 0 and rev_delta > 0:
        elasticity_verdict = "Inelastic Gain: Price increase outpaced customer volume sensitivity, generating a net top-line expansion."
    elif price_change_pct > 0 and rev_delta < 0:
        elasticity_verdict = "Elastic Penalty: Customer attrition from price hike outweighed margin per unit, reducing gross revenue."
    elif price_change_pct < 0 and rev_delta > 0:
        elasticity_verdict = "Volume Surge: Discount stimulated sufficient demand to increase total cash flow."
    elif price_change_pct < 0 and rev_delta < 0:
        elasticity_verdict = "Margin Erosion: Discount did not generate enough incremental unit sales to offset reduced unit price."
    else:
        elasticity_verdict = "Neutral Trajectory: Operations remained stable within standard statistical variance."

    # Prescriptive Strategic Recommendations
    recommendations = []
    if simulated_gross_margin_pct < 25.0:
        recommendations.append({
            "priority": "HIGH",
            "title": "Margin Compression Warning",
            "advice": f"Projected gross margin compresses to {round(simulated_gross_margin_pct, 1)}%. Implement selective tier bundling or cap marketing CAC."
        })
    if rev_delta > 0 and profit_delta > 0:
        recommendations.append({
            "priority": "SUCCESS",
            "title": "Accretive Decision Identified",
            "advice": f"Scenario unlocks +${round(rev_delta, 2):,} in projected revenue and +${round(profit_delta, 2):,} net margin. Greenlight roll-out."
        })
    elif profit_delta < 0:
        recommendations.append({
            "priority": "CAUTION",
            "title": "Profit Deterioration Risk",
            "advice": f"Estimated profit decline of -${round(abs(profit_delta), 2):,}. Rebalance price adjustments with higher-margin cross-sells."
        })

    if marketing_multiplier > 1.5:
        recommendations.append({
            "priority": "OPTIMIZE",
            "title": "Diminishing Returns on Ad Spend",
            "advice": "High ad multiplier approaches logarithmic saturation. Allocate incremental capital to customer retention over acquisition."
        })

    return {
        "status": "success",
        "table_name": table_name,
        "metric_column": metric_column,
        "parameters": {
            "price_change_pct": price_change_pct,
            "price_elasticity": price_elasticity,
            "marketing_multiplier": marketing_multiplier,
            "cost_inflation_pct": cost_inflation_pct,
            "churn_rate_pct": churn_rate_pct,
            "horizon_days": horizon_days
        },
        "scorecard": {
            "projected_revenue_delta": round(rev_delta, 2),
            "projected_revenue_delta_pct": round(rev_delta_pct, 2),
            "projected_profit_delta": round(profit_delta, 2),
            "projected_profit_delta_pct": round(profit_delta_pct, 2),
            "simulated_gross_margin_pct": round(simulated_gross_margin_pct, 2),
            "baseline_gross_margin_pct": round(baseline_margin_pct, 2),
            "volume_shift_pct": round((simulated_volume_factor - 1.0) * 100.0, 2),
            "elasticity_verdict": elasticity_verdict
        },
        "trajectories": baseline_trajectory,
        "recommendations": recommendations
    }
