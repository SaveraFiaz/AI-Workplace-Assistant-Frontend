"""
modules/contract_analyzer/service.py
--------------------------------------
Contract Analyzer using Gemini 2.5-flash.

Key optimization: All selected analysis types run in ONE single Gemini call
instead of 4 separate calls. This reduces API usage by 75% and avoids
hitting the free-tier daily request limit.

Flow:
  1. Extract full text from uploaded PDF or DOCX
  2. Save contract metadata + full text to PostgreSQL (avoid re-parsing)
  3. Send ONE combined prompt to Gemini for all selected types
  4. Parse structured JSON response
  5. Save analysis results to contract_analyses table
  6. Return structured response to the frontend
"""
import hashlib
import json
import time
import uuid
from pathlib import Path

from google import genai
from google.genai import errors as genai_errors
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader

from core.config import settings
from database import Contract, ContractAnalysis

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

LLM_MODEL = "gemini-2.5-flash"


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


def _call_gemini(prompt: str, retries: int = 3, delay: int = 15) -> str:
    """Sends a prompt to Gemini with automatic retry on 503 overload errors."""
    client = _get_client()
    for attempt in range(retries):
        try:
            response = client.models.generate_content(model=LLM_MODEL, contents=prompt)
            return response.text.strip()
        except genai_errors.ServerError as e:
            if '503' in str(e) and attempt < retries - 1:
                time.sleep(delay)
                continue
            raise HTTPException(status_code=503, detail="Gemini is temporarily overloaded. Please try again in a minute.")
        except genai_errors.ClientError as e:
            if '429' in str(e):
                raise HTTPException(status_code=429, detail="API quota exceeded. Please wait before trying again.")
            raise HTTPException(status_code=500, detail=str(e))


def _parse_json(text: str):
    """
    Safely parses JSON from Gemini response.
    Handles markdown code fences that Gemini sometimes adds.
    """
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text  = "\n".join(lines[1:-1]).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _extract_text(file_path: str, ext: str) -> str:
    """Extracts full plain text from a PDF or DOCX file."""
    loader    = PyPDFLoader(file_path) if ext == ".pdf" else Docx2txtLoader(file_path)
    documents = loader.load()
    if not documents:
        raise HTTPException(status_code=400, detail="Could not extract text from the contract.")
    return "\n\n".join(doc.page_content for doc in documents)


# ── Combined Single-Call Analysis ─────────────────────────────────────────────

def _analyze_contract_combined(contract_text: str, types: list) -> dict:
    """
    Runs ALL selected analysis types in ONE single Gemini API call.
    Reduces 4 API calls to 1 — avoids free-tier rate limits.
    """
    instructions = []

    if "summary" in types:
        instructions.append(
            '"summary": Write a 2-3 paragraph plain English overview covering: '
            'purpose of the contract, parties involved, main obligations, key terms '
            '(duration, payment, deliverables). No legal jargon.'
        )

    if "risks" in types:
        instructions.append(
            '"risks": JSON array of risky clauses. Each item must have: '
            '"clause" (short name), "level" ("High", "Medium", or "Low"), '
            '"explanation" (1-2 plain English sentences on WHY it is risky), '
            '"steps" (array of 2-4 plain actionable steps for a first-time signer, '
            'each starting with an action verb, no jargon). '
            'Look for: auto-renewal, penalties, liability limits, hidden fees, '
            'non-compete, termination terms, unfavorable governing law.'
        )

    if "legal_terms" in types:
        instructions.append(
            '"legal_terms": JSON array of complex legal terms found in the contract. '
            'Each item: "term" (as it appears in contract), '
            '"explanation" (1-2 plain English sentences a non-lawyer would understand).'
        )

    if "questions" in types:
        instructions.append(
            '"questions": JSON array of 5-8 question strings the signer should ask '
            'before signing. Focus on unclear terms, obligations, missing clauses, '
            'risks, and exit conditions.'
        )

    combined = "\n".join(f"  - {i}" for i in instructions)

    prompt = f"""You are a legal document analyst helping someone with NO legal background understand a contract.

Analyze the contract below and return a single JSON object with ONLY these fields:
{combined}

STRICT RULES:
- Return ONLY valid JSON — no markdown, no code fences, no text outside the JSON
- Use plain everyday English — no legal jargon
- For array fields, return [] if nothing relevant is found
- "steps" in each risk must tell EXACTLY what to do step by step (imagine explaining to someone signing their very first contract ever)
- "level" must be exactly "High", "Medium", or "Low"

CONTRACT:
{contract_text}

JSON RESPONSE:"""

    raw    = _call_gemini(prompt)
    parsed = _parse_json(raw)

    if not isinstance(parsed, dict):
        # Return safe fallback if JSON parsing fails
        result = {}
        if "summary"     in types: result["summary"]     = "Analysis failed to parse. Please try again."
        if "risks"       in types: result["risks"]       = []
        if "legal_terms" in types: result["legal_terms"] = []
        if "questions"   in types: result["questions"]   = []
        return result

    return parsed


# ── Legal Term Search ─────────────────────────────────────────────────────────

def explain_legal_term(term: str) -> dict:
    """
    Explains any legal term in simple layman language.
    Separate from contract analysis — triggered by the search box.
    """
    prompt = f"""You are a friendly legal translator explaining things to someone with no legal background.

Explain the legal term "{term}" in the simplest possible way.

Return ONLY a valid JSON object (no markdown, no code fences):
{{
  "term": "{term}",
  "simple_meaning": "One sentence a 12-year-old could understand",
  "full_explanation": "2-3 sentences with more detail, still plain English",
  "real_world_example": "A practical everyday example of when this applies",
  "watch_out_for": "What the person should be careful about when they see this in a contract"
}}"""

    raw    = _call_gemini(prompt)
    parsed = _parse_json(raw)

    if isinstance(parsed, dict):
        return parsed

    return {
        "term":               term,
        "simple_meaning":     raw,
        "full_explanation":   "",
        "real_world_example": "",
        "watch_out_for":      ""
    }


# ── Main Entry Point ──────────────────────────────────────────────────────────

async def run_contract_analysis(
    file:           UploadFile,
    analysis_types: list,
    db:             Session
) -> dict:
    """
    Main function called by the router.
    Handles file processing, single Gemini call, and DB persistence.
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not set.")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".docx"]:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    if not analysis_types:
        raise HTTPException(status_code=400, detail="Select at least one analysis type.")

    # Step 1: Read file and compute hash
    file_bytes = await file.read()
    file_hash  = _sha256(file_bytes)

    # Step 2: Reuse stored text if same file uploaded before
    existing = db.query(Contract).filter(Contract.file_hash == file_hash).first()

    if existing:
        contract_text   = existing.full_text
        contract_record = existing
    else:
        temp_path = UPLOAD_DIR / f"{uuid.uuid4()}{ext}"
        temp_path.write_bytes(file_bytes)
        try:
            contract_text = _extract_text(str(temp_path), ext)
        finally:
            if temp_path.exists():
                temp_path.unlink()

        contract_record = Contract(
            filename  = file.filename,
            file_hash = file_hash,
            full_text = contract_text
        )
        db.add(contract_record)
        db.commit()
        db.refresh(contract_record)

    # Step 3: Run ALL selected types in ONE Gemini call
    result = _analyze_contract_combined(contract_text, analysis_types)

    # Step 4: Save analysis to PostgreSQL
    db.add(ContractAnalysis(
        contract_id    = contract_record.id,
        analysis_types = json.dumps(analysis_types),
        summary        = result.get("summary"),
        risks          = json.dumps(result.get("risks", [])),
        legal_terms    = json.dumps(result.get("legal_terms", [])),
        questions      = json.dumps(result.get("questions", []))
    ))
    db.commit()

    return result
