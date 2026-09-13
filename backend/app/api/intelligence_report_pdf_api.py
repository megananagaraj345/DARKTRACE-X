from __future__ import annotations
from datetime import datetime, timezone
from io import BytesIO
from typing import List
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

router = APIRouter(prefix="/intelligence-report", tags=["Batch 14 - PDF Intelligence Report"])

class PDFReportRequest(BaseModel):
    actor_id: str = "ACTOR-SYNTH-001"
    aliases: List[str] = Field(default_factory=lambda: ["night_vector"])
    platforms: List[str] = Field(default_factory=lambda: ["synthetic-forum"])
    current_state: str = "Preparation"
    predicted_state: str = "Operational Activity"
    risk_score: float = 78
    confidence: float = 0.84
    prediction_probability: float = 0.83
    evidence_count: int = 5
    relationship_confidence: float = 0.80
    supporting_evidence: List[str] = Field(default_factory=list)
    contradictory_evidence: List[str] = Field(default_factory=list)
    what_changed: List[str] = Field(default_factory=list)
    infrastructure: List[str] = Field(default_factory=list)
    blockchain_signals: List[str] = Field(default_factory=list)
    campaigns: List[str] = Field(default_factory=list)
    mitre_attack: List[str] = Field(default_factory=list)
    indicators: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    analyst_assessment: str = "Assessment based on correlated synthetic/authorized evidence; attribution is not confirmed."

def _pct(value: float) -> str:
    return f"{max(0, min(100, round(float(value) * 100)))}%"

def _bullets(items: List[str]) -> str:
    return "<br/>".join(f"• {item}" for item in items) if items else "None recorded"

def build_pdf(request: PDFReportRequest) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=16*mm, leftMargin=16*mm,
                            topMargin=15*mm, bottomMargin=15*mm,
                            title=f"DARKTRACE-X Intelligence Report - {request.actor_id}", author="DARKTRACE-X")
    styles = getSampleStyleSheet()
    title = ParagraphStyle("DTTitle", parent=styles["Title"], alignment=TA_CENTER, fontSize=20, spaceAfter=8)
    subtitle = ParagraphStyle("DTSubtitle", parent=styles["Normal"], alignment=TA_CENTER, fontSize=9,
                              textColor=colors.grey, spaceAfter=16)
    heading = ParagraphStyle("DTHeading", parent=styles["Heading2"], fontSize=13, spaceBefore=10, spaceAfter=6)
    body = ParagraphStyle("DTBody", parent=styles["BodyText"], fontSize=9, leading=13, spaceAfter=5)
    small = ParagraphStyle("DTSmall", parent=styles["BodyText"], fontSize=8, leading=11)
    story = [
        Paragraph("DARKTRACE-X", title),
        Paragraph("Evidence-Driven Threat Intelligence Report", subtitle),
        Paragraph(f"<b>Actor:</b> {request.actor_id} &nbsp;&nbsp; <b>Generated:</b> "
                  f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", body),
        Paragraph("1. Executive Assessment", heading),
    ]
    data = [
        ["Risk", f"{round(request.risk_score)}/100"],
        ["Analytical confidence", _pct(request.confidence)],
        ["Current operational state", request.current_state],
        ["Predicted next state", request.predicted_state],
        ["Prediction probability", _pct(request.prediction_probability)],
        ["Evidence items", str(request.evidence_count)],
        ["Relationship confidence", _pct(request.relationship_confidence)],
    ]
    table = Table(data, colWidths=[65*mm, 105*mm])
    table.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.4, colors.lightgrey),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BACKGROUND", (0,0), (0,-1), colors.whitesmoke),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
    ]))
    story += [table, Spacer(1,8)]
    sections = [
        ("2. Actor Profile", f"<b>Aliases:</b> {', '.join(request.aliases) or 'None recorded'}<br/>"
                             f"<b>Platforms:</b> {', '.join(request.platforms) or 'None recorded'}"),
        ("3. Supporting Evidence", _bullets(request.supporting_evidence)),
        ("4. Counter-Evidence / Resilience", _bullets(request.contradictory_evidence)),
        ("5. What Changed", _bullets(request.what_changed)),
        ("6. Infrastructure Intelligence", _bullets(request.infrastructure)),
        ("7. Blockchain Signals", _bullets(request.blockchain_signals)),
        ("8. Campaign Intelligence", _bullets(request.campaigns)),
        ("9. MITRE ATT&CK Mapping", _bullets(request.mitre_attack)),
        ("10. Indicators", _bullets(request.indicators)),
        ("11. Defensive Recommendations", _bullets(request.recommendations)),
        ("12. Analyst Assessment", request.analyst_assessment),
    ]
    for heading_text, content in sections:
        story.append(Paragraph(heading_text, heading))
        story.append(Paragraph(content, body))
    story += [
        Spacer(1,10),
        Paragraph("<b>Evidence statement:</b> DARKTRACE-X correlates independent observations into an "
                  "analytical threat picture. Similarity, behavioral correlation, infrastructure overlap, "
                  "or predictive scores do not by themselves establish the real-world identity of a person.", small),
        Spacer(1,8),
        Paragraph("Mode: synthetic / public / authorized intelligence analysis. Use only data that you are permitted to collect and analyze.", small),
    ]
    doc.build(story)
    buffer.seek(0)
    return buffer

@router.post("/pdf")
def generate_pdf(request: PDFReportRequest):
    pdf = build_pdf(request)
    filename = f"DARKTRACE-X_{request.actor_id}_intelligence_report.pdf"
    return StreamingResponse(pdf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})

@router.get("/pdf/health")
def pdf_health():
    return {"status": "ok", "module": "DARKTRACE-X PDF Intelligence Reporting", "version": "1.0"}
