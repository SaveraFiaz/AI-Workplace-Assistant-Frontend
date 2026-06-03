"""
database.py
-----------
PostgreSQL connection + all table models.

Tables:
  users          → registered employee accounts (auth)
  documents      → uploaded document metadata (RAG)
  search_history → every Q&A performed on a document (RAG)
"""
from sqlalchemy import (
    create_engine, Column, Integer, String,
    DateTime, ForeignKey, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from core.config import settings

engine       = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


# ── Auth ─────────────────────────────────────────────────────────────────────

class User(Base):
    """
    Stores registered employee accounts.
    Passwords are stored as bcrypt hashes.
    """
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(255), nullable=False)
    email           = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    active_token    = Column(String(500), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


# ── Knowledge Search (RAG) ───────────────────────────────────────────────────

class Document(Base):
    """
    Stores metadata for every document uploaded by users.

    file_hash       → SHA-256 of file bytes, used to detect duplicate uploads
                      so we don't re-embed the same file twice.
    collection_name → The ChromaDB collection where this document's
                      vector embeddings are stored on disk.
    chunk_count     → How many text chunks the document was split into.
    """
    __tablename__ = "documents"

    id              = Column(Integer, primary_key=True, index=True)
    filename        = Column(String(255), nullable=False)
    file_hash       = Column(String(64), unique=True, index=True, nullable=False)
    collection_name = Column(String(100), unique=True, nullable=False)
    chunk_count     = Column(Integer, default=0)
    uploaded_at     = Column(DateTime, default=datetime.utcnow)

    # One document → many search history records
    searches = relationship("SearchHistory", back_populates="document")


class SearchHistory(Base):
    """
    Records every question asked and answer returned for a document.
    Useful for audit trail, analytics, and showing past searches.
    """
    __tablename__ = "search_history"

    id          = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    question    = Column(Text, nullable=False)
    answer      = Column(Text, nullable=False)
    source      = Column(String(500))
    searched_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="searches")


# ── Contract Analyzer ────────────────────────────────────────────────────────

class Contract(Base):
    """
    Stores metadata for every contract uploaded for analysis.

    file_hash → SHA-256 used to detect duplicate uploads.
    full_text → extracted plain text of the contract stored in DB
                so we never re-parse the same file again.
    """
    __tablename__ = "contracts"

    id          = Column(Integer, primary_key=True, index=True)
    filename    = Column(String(255), nullable=False)
    file_hash   = Column(String(64), unique=True, index=True, nullable=False)
    full_text   = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    analyses = relationship("ContractAnalysis", back_populates="contract")


class ContractAnalysis(Base):
    """
    Stores one analysis result for a contract.
    A single contract can be analyzed many times with different options.

    analysis_types → JSON string of selected options e.g. '["summary","risks"]'
    summary        → plain English overview of the contract
    risks          → JSON array of risky clauses with level + explanation
    legal_terms    → JSON array of complex terms with plain English meanings
    questions      → JSON array of suggested questions before signing
    """
    __tablename__ = "contract_analyses"

    id             = Column(Integer, primary_key=True, index=True)
    contract_id    = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    analysis_types = Column(String(500), nullable=False)
    summary        = Column(Text, nullable=True)
    risks          = Column(Text, nullable=True)
    legal_terms    = Column(Text, nullable=True)
    questions      = Column(Text, nullable=True)
    analyzed_at    = Column(DateTime, default=datetime.utcnow)

    contract = relationship("Contract", back_populates="analyses")


# ── Email Reply ──────────────────────────────────────────────────────────────

class EmailReply(Base):
    """
    Stores every email reply generated by the AI.

    original_email  → the email the user pasted
    tone            → selected tone: formal | polite | firm
    company_format  → optional company guidelines provided by user
    generated_reply → the AI-generated reply text
    """
    __tablename__ = "email_replies"

    id              = Column(Integer, primary_key=True, index=True)
    original_email  = Column(Text, nullable=False)
    tone            = Column(String(20), nullable=False)
    company_format  = Column(Text, nullable=True)
    generated_reply = Column(Text, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)


# ── Shared helpers ───────────────────────────────────────────────────────────

def create_tables():
    """Creates all tables in PostgreSQL if they don't already exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — one DB session per request, auto-closed after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
