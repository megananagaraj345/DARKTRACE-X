from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func

from app.database import Base


class ActorDigitalTwin(Base):
    """
    Actor Digital Twin model for DARKTRACE-X.

    Stores an evolving intelligence profile of a synthetic
    or assessed threat actor.

    This model represents intelligence assessment,
    not confirmed real-world identity.
    """

    __tablename__ = "actor_digital_twins"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    actor_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    display_name = Column(
        String,
        nullable=False
    )

    aliases = Column(
        Text,
        nullable=True
    )

    platforms = Column(
        Text,
        nullable=True
    )

    writing_style = Column(
        Text,
        nullable=True
    )

    activity_pattern = Column(
        Text,
        nullable=True
    )

    infrastructure = Column(
        Text,
        nullable=True
    )

    wallets = Column(
        Text,
        nullable=True
    )

    campaigns = Column(
        Text,
        nullable=True
    )

    current_state = Column(
        String,
        nullable=True
    )

    state_confidence = Column(
        Float,
        nullable=True
    )

    confidence = Column(
        Float,
        nullable=False,
        default=0.0
    )

    risk_score = Column(
        Float,
        nullable=False,
        default=0.0
    )

    analyst_assessment = Column(
        Text,
        nullable=True
    )

    first_seen = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    last_updated = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )