import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.services.deck_exporter import create_executive_pptx_deck

router = APIRouter(prefix="/api/reports", tags=["Executive Reports & Decks"])

class DeckExportRequest(BaseModel):
    table_name: str
    metric_name: Optional[str] = "Metric"
    model_summary: Optional[Dict[str, Any]] = {}
    top_performing_items: Optional[List[Dict[str, Any]]] = []
    underperforming_items: Optional[List[Dict[str, Any]]] = []
    client_recommendations: Optional[List[Dict[str, Any]]] = []
    historical_points: Optional[List[Dict[str, Any]]] = []
    forecast_points: Optional[List[Dict[str, Any]]] = []

@router.post("/deck/export-pptx")
def export_powerpoint_deck(req: DeckExportRequest):
    """
    Dynamically compiles and streams a 16:9 widescreen PowerPoint executive briefing presentation (.pptx).
    """
    try:
        pptx_bytes = create_executive_pptx_deck(
            table_name=req.table_name,
            metric_name=req.metric_name or "Metric",
            model_summary=req.model_summary or {},
            top_performers=req.top_performing_items or [],
            low_performers=req.underperforming_items or [],
            recommendations=req.client_recommendations or [],
            historical_points=req.historical_points,
            forecast_points=req.forecast_points
        )

        filename = f"DataForge_Executive_Deck_{req.table_name}_{datetime.utcnow().strftime('%Y%m%d')}.pptx"
        encoded_filename = urllib.parse.quote(filename)

        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PowerPoint presentation deck: {str(e)}"
        )
