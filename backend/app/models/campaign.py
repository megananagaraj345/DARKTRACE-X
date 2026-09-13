from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Campaign(Base):
    """
    Campaign model for DARKTRACE-X.

    Stores emerging or assessed threat campaigns discovered
    from correlated synthetic intelligence signals.

    Campaign detection is an intelligence assessment and
    should not be interpreted as confirmed attribution.
    """

    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)

    campaign_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    actor_id = Column(
        String,
        nullable=True,
        index=True
    )

    confidence = Column(
        Float,
        nullable=False,
        default=0.0
    )

    status = Column(
        String,
        nullable=False,
        default="emerging"
    )

    signal_count = Column(
        Integer,
        nullable=False,
        default=0
    )

    supporting_evidence = Column(
        Text,
        nullable=True
    )

    related_entities = Column(
        Text,
        nullable=True
    )

    assessment = Column(
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