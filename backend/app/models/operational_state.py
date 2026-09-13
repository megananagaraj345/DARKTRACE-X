from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func

from app.database import Base


class OperationalState(Base):
    """
    Operational State model for DARKTRACE-X.

    Stores the current assessed operational state of an
    actor based on observed signals and intelligence evidence.

    This is an intelligence assessment, not a confirmed fact
    about a real-world person or organization.
    """

    __tablename__ = "operational_states"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    actor_id = Column(
        String,
        nullable=False,
        index=True
    )

    current_state = Column(
        String,
        nullable=False
    )

    state_confidence = Column(
        Float,
        nullable=False,
        default=0.0
    )

    supporting_evidence = Column(
        Text,
        nullable=True
    )

    contradictory_evidence = Column(
        Text,
        nullable=True
    )

    evidence_count = Column(
        Integer,
        nullable=False,
        default=0
    )

    assessment = Column(
        Text,
        nullable=True
    )

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    last_updated = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )