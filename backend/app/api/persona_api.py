from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.persona import Persona


router = APIRouter(
    prefix="/personas",
    tags=["Personas"]
)


@router.post("/")
def create_persona(
    platform: str,
    username: str,
    db: Session = Depends(get_db)
):
    persona = Persona(
        platform=platform,
        username=username
    )

    db.add(persona)
    db.commit()
    db.refresh(persona)

    return {
        "id": persona.id,
        "platform": persona.platform,
        "username": persona.username,
        "risk_score": persona.risk_score
    }


@router.get("/")
def get_personas(
    db: Session = Depends(get_db)
):
    personas = db.query(Persona).all()

    return personas