import httpx
from datetime import datetime
from typing import Dict, Any, Optional

async def dispatch_slack_alert(
    webhook_url: str,
    table_name: str,
    metric_name: str,
    severity: str,
    triggered_value: float,
    expected_value: Optional[float],
    message: str
) -> Dict[str, Any]:
    """
    Dispatches a rich Slack Block Kit notification payload to incoming webhook URL.
    """
    severity_emoji = "🚨" if severity == "CRITICAL" else "⚠️" if severity == "WARNING" else "ℹ️"
    
    payload = {
        "text": f"{severity_emoji} DataForge AI Alert: {severity} anomaly detected in {table_name}",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{severity_emoji} DataForge AI Watchdog Alert • {severity}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Dataset:* `{table_name}`"},
                    {"type": "mrkdwn", "text": f"*Metric:* `{metric_name}`"},
                    {"type": "mrkdwn", "text": f"*Triggered Value:* *${triggered_value:,.2f}*"},
                    {"type": "mrkdwn", "text": f"*Expected Baseline:* *${expected_value:,.2f}*" if expected_value else "*N/A*"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{message}*\n_Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}_"
                }
            },
            {
                "type": "divider"
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code < 300:
                return {"success": True, "status": "DELIVERED", "status_code": resp.status_code}
            else:
                return {"success": False, "status": "FAILED", "detail": resp.text[:200], "status_code": resp.status_code}
    except Exception as e:
        return {"success": False, "status": "FAILED", "error": str(e)}


async def dispatch_generic_webhook(
    webhook_url: str,
    payload_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Dispatches JSON event payload to custom enterprise webhook endpoint (Zapier, Make, MS Teams, AWS Lambda).
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload_data)
            return {
                "success": resp.status_code < 300,
                "status_code": resp.status_code,
                "status": "DELIVERED" if resp.status_code < 300 else "FAILED"
            }
    except Exception as e:
        return {"success": False, "status": "FAILED", "error": str(e)}
