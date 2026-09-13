from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.post import Post
from app.models.persona import Persona


router = APIRouter(
    prefix="/posts",
    tags=["Posts"]
)


@router.post("/")
def create_post(
    persona_id: int,
    text: str,
    source: str = "synthetic",
    db: Session = Depends(get_db)
):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()

    if not persona:
        return {
            "error": "Persona not found"
        }

    post = Post(
        persona_id=persona_id,
        text=text,
        source=source
    )

    db.add(post)
    db.commit()
    db.refresh(post)

    return {
        "id": post.id,
        "persona_id": post.persona_id,
        "text": post.text,
        "source": post.source
    }


@router.get("/")
def get_posts(
    db: Session = Depends(get_db)
):
    posts = db.query(Post).all()

    return posts