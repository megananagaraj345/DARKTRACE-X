from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)

    signal_id = Column(
        Integer,
        nullable=False
    )

    entity_a = Column(String, nullable=False)

    entity_b = Column(String, nullable=False)

    explanation = Column(String, nullable=False)

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )