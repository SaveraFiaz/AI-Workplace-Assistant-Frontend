from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, Document, SearchHistory
from modules.knowledge_search.service import run_knowledge_search, run_query_by_document_id, index_document

router = APIRouter()


@router.post("/knowledge-search/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session      = Depends(get_db),
):
    """Index a document into ChromaDB without asking a question yet."""
    return await index_document(file, db)


@router.post("/knowledge-search")
async def knowledge_search(
    file: UploadFile = File(...),
    question: str    = Form(...),
    db: Session      = Depends(get_db),
):
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    return await run_knowledge_search(file, question, db)


class QueryRequest(BaseModel):
    document_id: int
    question:    str


@router.post("/knowledge-search/query")
async def query_existing_document(
    data: QueryRequest,
    db: Session = Depends(get_db),
):
    if not data.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    return await run_query_by_document_id(data.document_id, data.question, db)


@router.get("/knowledge-search/docs")
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.uploaded_at.desc()).all()
    return [
        {
            "id":          d.id,
            "filename":    d.filename,
            "chunk_count": d.chunk_count,
            "uploaded_at": d.uploaded_at,
        }
        for d in docs
    ]


@router.delete("/knowledge-search/docs/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    """Delete a document and its search history from DB and ChromaDB."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Delete ChromaDB collection
    try:
        import chromadb
        from core.config import settings
        client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        client.delete_collection(doc.collection_name)
    except Exception:
        pass  # collection may not exist, continue

    # Delete search history then document from PostgreSQL
    db.query(SearchHistory).filter(SearchHistory.document_id == doc_id).delete()
    db.delete(doc)
    db.commit()

    return {"message": f"'{doc.filename}' deleted successfully."}


@router.get("/knowledge-search/history")
def search_history(db: Session = Depends(get_db)):
    records = (
        db.query(SearchHistory)
        .order_by(SearchHistory.searched_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id":          r.id,
            "document":    r.document.filename,
            "question":    r.question,
            "answer":      r.answer,
            "source":      r.source,
            "searched_at": r.searched_at,
        }
        for r in records
    ]
