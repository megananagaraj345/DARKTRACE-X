from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func

from app.database import Base


class TimelineEvent(Base):
    """
    Timeline Event model for DARKTRACE-X.

    Stores chronological intelligence events associated
    with a synthetic or assessed threat actor.

    Events are used by the Activity Replay Engine to
    reconstruct how an operation developed over time.

    This represents an intelligence assessment and should
    not be interpreted as confirmed attribution.
    """

    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)

    actor_id = Column(
        String,
        nullable=False,
        index=True
    )

    event_type = Column(
        String,
        nullable=False
    )

    description = Column(
        Text,
        nullable=False
    )

    confidence = Column(
        Float,
        nullable=False,
        default=0.0
    )

    source = Column(
        String,
        nullable=True
    )

    related_entity = Column(
        String,
        nullable=True
    )

    operational_state = Column(
        String,
        nullable=True
    )

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )