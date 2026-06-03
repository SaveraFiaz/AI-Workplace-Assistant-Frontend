import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, ContractAnalysis
from modules.contract_analyzer.service import run_contract_analysis, explain_legal_term

router = APIRouter()


@router.post("/contract-analyzer")
async def analyze_contract(
    file:           UploadFile = File(...),
    analysis_types: str        = Form(...),
    db: Session                = Depends(get_db),
):
    try:
        types = json.loads(analysis_types)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid analysis_types format.")

    if not isinstance(types, list) or len(types) == 0:
        raise HTTPException(status_code=400, detail="Select at least one analysis type.")

    return await run_contract_analysis(file, types, db)


class TermRequest(BaseModel):
    term: str


@router.post("/contract-analyzer/explain-term")
def explain_term(data: TermRequest):
    if not data.term.strip():
        raise HTTPException(status_code=400, detail="Term cannot be empty.")
    return explain_legal_term(data.term.strip())


@router.get("/contract-analyzer/history")
def analysis_history(db: Session = Depends(get_db)):
    records = (
        db.query(ContractAnalysis)
        .order_by(ContractAnalysis.analyzed_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id":             r.id,
            "contract":       r.contract.filename,
            "analysis_types": json.loads(r.analysis_types),
            "analyzed_at":    r.analyzed_at,
        }
        for r in records
    ]
