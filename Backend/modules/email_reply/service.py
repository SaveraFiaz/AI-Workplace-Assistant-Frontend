"""
modules/email_reply/service.py
--------------------------------
Email Reply Generator using Gemini 2.5-flash.

Flow:
  1. User pastes an email + selects a tone (formal / polite / firm)
  2. Optionally provides company email format guidelines
  3. One Gemini call generates the reply in the chosen tone
  4. Reply saved to PostgreSQL email_replies table
  5. Reply returned to the frontend

Each tone has a distinct personality:
  - Formal  → professional, structured, corporate language
  - Polite  → warm, friendly, approachable but still professional
  - Firm    → confident, direct, clear boundaries — no fluff
"""
import time
from google import genai
from google.genai import errors as genai_errors
from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.config import settings
from database import EmailReply

LLM_MODEL = "gemini-2.5-flash"

TONE_DESCRIPTIONS = {
    "formal": (
        "Write in a formal, professional corporate tone. "
        "Use structured language, avoid contractions, maintain a respectful distance. "
        "Begin with 'Dear [Name],' and end with 'Yours sincerely,' or 'Best regards,'. "
        "The reply must sound like it comes from a senior professional."
    ),
    "polite": (
        "Write in a warm, friendly, and polite tone. "
        "Be approachable and kind while remaining professional. "
        "Use natural language with light contractions. "
        "Begin with 'Hi [Name],' or 'Hello [Name],' and end with 'Best wishes,' or 'Kind regards,'. "
        "The reply should feel human and personable."
    ),
    "firm": (
        "Write in a firm, direct, and confident tone. "
        "Be assertive and clear — no excessive pleasantries or filler words. "
        "State the position clearly and concisely. "
        "Begin with 'Dear [Name],' and end with 'Regards,'. "
        "The reply should leave no room for ambiguity."
    ),
}


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


def _call_gemini_with_retry(prompt: str, retries: int = 3, delay: int = 15) -> str:
    """
    Calls Gemini with automatic retry on 503 (server overloaded) errors.
    Waits `delay` seconds between retries.
    """
    client = _get_client()
    for attempt in range(retries):
        try:
            response = client.models.generate_content(model=LLM_MODEL, contents=prompt)
            return response.text.strip()
        except genai_errors.ServerError as e:
            if '503' in str(e) and attempt < retries - 1:
                time.sleep(delay)
                continue
            raise HTTPException(
                status_code=503,
                detail=f"Gemini is temporarily overloaded. Please try again in a minute."
            )
        except genai_errors.ClientError as e:
            if '429' in str(e):
                raise HTTPException(
                    status_code=429,
                    detail="API quota exceeded. Please wait before trying again."
                )
            raise HTTPException(status_code=500, detail=str(e))


def generate_email_reply(
    email_text:     str,
    tone:           str,
    company_format: str | None,
    db:             Session
) -> dict:
    """
    Generates a single email reply in the chosen tone.
    Saves the result to PostgreSQL and returns it.
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not set.")

    tone = tone.lower().strip()
    if tone not in TONE_DESCRIPTIONS:
        raise HTTPException(status_code=400, detail="Tone must be one of: formal, polite, firm.")

    if not email_text.strip():
        raise HTTPException(status_code=400, detail="Email text cannot be empty.")

    # Build company format section if provided
    format_section = ""
    if company_format and company_format.strip():
        format_section = f"""
Company Email Format Guidelines (MUST follow these):
{company_format.strip()}
"""

    tone_instruction = TONE_DESCRIPTIONS[tone]

    prompt = f"""You are a professional email assistant helping someone write a reply.

TONE INSTRUCTION:
{tone_instruction}
{format_section}
ORIGINAL EMAIL RECEIVED:
{email_text.strip()}

TASK:
Write a professional reply to the email above.

Rules:
- Follow the tone instruction strictly
- Keep the reply concise and relevant — do not add unnecessary content
- If a name is unknown, use a placeholder like [Name] or [Recipient]
- If company format guidelines are provided, follow them exactly
- Return ONLY the email reply text — no explanation, no subject line, no extra commentary

EMAIL REPLY:"""

    reply = _call_gemini_with_retry(prompt)

    # Save to PostgreSQL
    db.add(EmailReply(
        original_email  = email_text.strip(),
        tone            = tone,
        company_format  = company_format.strip() if company_format else None,
        generated_reply = reply
    ))
    db.commit()

    return {
        "tone":  tone,
        "reply": reply
    }


def refine_email_reply(
    original_email:  str,
    current_reply:   str,
    tone:            str,
    change_request:  str,
    db:              Session
) -> dict:
    """
    Takes the already-generated reply and refines it based on
    the user's requested changes (e.g. 'make it shorter',
    'add deadline of Friday', 'sound more confident').
    Saves the refined version to PostgreSQL.
    """
    if not change_request.strip():
        raise HTTPException(status_code=400, detail="Please describe what changes you want.")

    prompt = f"""You are a professional email assistant. A reply was already written and the user wants specific changes.

ORIGINAL EMAIL RECEIVED:
{original_email.strip()}

CURRENT REPLY ({tone} tone):
{current_reply.strip()}

USER'S REQUESTED CHANGES:
{change_request.strip()}

TASK:
Revise the reply above exactly according to the user's requested changes.
Keep the {tone} tone unless the user specifically asks to change it.

Rules:
- Apply ONLY the requested changes — do not rewrite things that were not mentioned
- Keep the same overall structure unless asked to change it
- Return ONLY the revised email reply text — no explanation, no commentary

REVISED REPLY:"""

    refined = _call_gemini_with_retry(prompt)

    # Save refined version to PostgreSQL
    db.add(EmailReply(
        original_email  = original_email.strip(),
        tone            = tone,
        company_format  = f"[Refined] {change_request.strip()}",
        generated_reply = refined
    ))
    db.commit()

    return {
        "tone":  tone,
        "reply": refined
    }
