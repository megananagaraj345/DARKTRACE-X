from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Edge(Base):
    __tablename__ = "edges"

    id = Column(Integer, primary_key=True, index=True)

    persona_a = Column(String, nullable=False)

    persona_b = Column(String, nullable=False)

    confidence = Column(Float, nullable=False)

    status = Column(
        String,
        default="possible_relationship"
    )

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )