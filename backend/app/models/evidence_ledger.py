from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func

from app.database import Base


class EvidenceLedger(Base):
    """
    Evidence Ledger for DARKTRACE-X.

    Stores the reasoning chain behind an intelligence assessment:

    Claim
        ↓
    Observation
        ↓
    Signal
        ↓
    Model Result
        ↓
    Fusion
        ↓
    Confidence
        ↓
    Analyst Assessment
    """

    __tablename__ = "evidence_ledger"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Entity or relationship being assessed
    entity_a = Column(
        String,
        nullable=False
    )

    entity_b = Column(
        String,
        nullable=True
    )

    # Intelligence reasoning chain
    claim = Column(
        Text,
        nullable=False
    )

    observation = Column(
        Text,
        nullable=False
    )

    signal_type = Column(
        String,
        nullable=False
    )

    signal_value = Column(
        Float,
        nullable=True
    )

    model_result = Column(
        Text,
        nullable=True
    )

    fusion_score = Column(
        Float,
        nullable=True
    )

    confidence = Column(
        Float,
        nullable=False
    )

    # Analyst assessment
    analyst_assessment = Column(
        Text,
        nullable=True
    )

    # Source of the evidence
    source = Column(
        String,
        nullable=True
    )

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )