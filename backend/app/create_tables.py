from app.database import engine, Base

from app.models.persona import Persona
from app.models.post import Post
from app.models.signal import Signal
from app.models.evidence import Evidence
from app.models.edge import Edge
from app.models.evidence_ledger import EvidenceLedger
from app.models.actor_digital_twin import ActorDigitalTwin
from app.models.operational_state import OperationalState
from app.models.timeline_event import TimelineEvent
from app.models.campaign import Campaign


print("Creating DARKTRACE-X database tables...")


Base.metadata.create_all(bind=engine)


print("All tables created successfully!")