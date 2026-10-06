import pytest
import pandas as pd
from app.services.campaign_intelligence import (
    generate_default_marketing_data,
    detect_marketing_columns,
    compute_campaign_analytics
)

def test_generate_default_marketing_data():
    df = generate_default_marketing_data()
    assert not df.empty
    assert len(df) > 200 # Multiple months across multiple channels
    expected_cols = {'date', 'channel', 'campaign', 'impressions', 'clicks', 'conversions', 'cost', 'revenue', 'profit'}
    assert expected_cols.issubset(set(df.columns))

    # Validate scale roughly matches the benchmark in the reference dashboard
    total_impr = df['impressions'].sum()
    total_clicks = df['clicks'].sum()
    assert 10_000_000 <= total_impr <= 20_000_000
    assert 100_000 <= total_clicks <= 300_000

def test_detect_marketing_columns():
    df = pd.DataFrame({
        'ad_date': ['2023-05-01', '2023-05-02'],
        'platform': ['Facebook', 'Instagram'],
        'promo_campaign': ['Summer Push', 'Summer Push'],
        'ad_views': [10000, 15000],
        'visits': [150, 220],
        'ad_spend': [120.50, 180.00],
        'orders': [25, 38],
        'margin': [350.00, 480.00]
    })
    mapping = detect_marketing_columns(df)
    assert mapping['channel_col'] == 'platform'
    assert mapping['campaign_col'] == 'promo_campaign'
    assert mapping['date_col'] == 'ad_date'
    assert mapping['impressions_col'] == 'ad_views'
    assert mapping['clicks_col'] == 'visits'
    assert mapping['cost_col'] == 'ad_spend'
    assert mapping['conversions_col'] == 'orders'
    assert mapping['profit_col'] == 'margin'

def test_compute_campaign_analytics_overall():
    df = generate_default_marketing_data()
    analytics = compute_campaign_analytics(df=df)

    # Validate KPIs
    kpis = analytics['kpis']
    assert 'impressions' in kpis
    assert 'clicks' in kpis
    assert 'conversions' in kpis
    assert 'cost' in kpis
    assert 'profit' in kpis
    assert len(kpis['impressions']['sparkline']) >= 5

    # Validate Donuts
    donuts = analytics['donuts']
    assert len(donuts['impressions_by_channel']) >= 3
    assert len(donuts['conversions_by_channel']) >= 3
    assert len(donuts['spending_by_channel']) >= 3
    assert len(donuts['profit_by_channel']) >= 3

    # Total percentage in donut should be approximately 100%
    impr_pct_sum = sum(item['percentage'] for item in donuts['impressions_by_channel'])
    assert 99.0 <= impr_pct_sum <= 101.0

    # Validate Bar Chart
    bars = analytics['bar_clicks_ctr']
    assert len(bars) >= 3
    for b in bars:
        assert 'clicks' in b
        assert 'ctr_pct' in b
        assert b['ctr_pct'] > 0

    # Validate Trend Over Time
    trend = analytics['trend_over_time']
    assert len(trend) >= 5 # Several months
    for t in trend:
        assert 'month' in t
        assert 'impressions' in t
        assert 'season' in t

    # Validate Day of Week
    dow = analytics['day_of_week']
    assert len(dow) == 7 # 7 days
    assert dow[0]['day'] == 'Monday'
    assert dow[6]['day'] == 'Sunday'

def test_compute_campaign_analytics_filtered():
    df = generate_default_marketing_data()
    # Filter by specific channel
    analytics_ig = compute_campaign_analytics(df=df, channel_filter='Instagram')
    assert analytics_ig['kpis']['impressions']['value'] < compute_campaign_analytics(df=df)['kpis']['impressions']['value']
    
    # Filter by date range
    analytics_range = compute_campaign_analytics(
        df=df,
        start_date='2023-06-01',
        end_date='2023-08-31'
    )
    assert analytics_range['kpis']['impressions']['value'] > 0
    assert analytics_range['kpis']['impressions']['value'] < compute_campaign_analytics(df=df)['kpis']['impressions']['value']
