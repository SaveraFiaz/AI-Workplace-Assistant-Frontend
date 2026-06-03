from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, EmailReply
from modules.email_reply.service import generate_email_reply, refine_email_reply

router = APIRouter()


class EmailReplyRequest(BaseModel):
    email:          str
    tone:           str
    company_format: str | None = None


@router.post("/email-reply")
def create_email_reply(data: EmailReplyRequest, db: Session = Depends(get_db)):
    if not data.email.strip():
        raise HTTPException(status_code=400, detail="Email text cannot be empty.")
    if not data.tone.strip():
        raise HTTPException(status_code=400, detail="Please select a tone.")
    return generate_email_reply(
        email_text     = data.email,
        tone           = data.tone,
        company_format = data.company_format,
        db             = db,
    )


class RefineRequest(BaseModel):
    original_email: str
    current_reply:  str
    tone:           str
    change_request: str


@router.post("/email-reply/refine")
def refine_reply(data: RefineRequest, db: Session = Depends(get_db)):
    if not data.change_request.strip():
        raise HTTPException(status_code=400, detail="Please describe the changes you want.")
    return refine_email_reply(
        original_email = data.original_email,
        current_reply  = data.current_reply,
        tone           = data.tone,
        change_request = data.change_request,
        db             = db,
    )


@router.get("/email-reply/history")
def reply_history(db: Session = Depends(get_db)):
    records = (
        db.query(EmailReply)
        .order_by(EmailReply.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id":             r.id,
            "tone":           r.tone,
            "original_email": r.original_email[:100] + "..." if len(r.original_email) > 100 else r.original_email,
            "reply_preview":  r.generated_reply[:100] + "..." if len(r.generated_reply) > 100 else r.generated_reply,
            "created_at":     r.created_at,
        }
        for r in records
    ]
