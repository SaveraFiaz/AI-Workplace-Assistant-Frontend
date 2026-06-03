"""
modules/knowledge_search/service.py
------------------------------------
RAG pipeline:
- google-genai SDK (gemini-2.5-flash)     for LLM
- google-genai SDK (gemini-embedding-001) for embeddings
- ChromaDB                                for vector storage (persisted to disk)
- PostgreSQL                              for document metadata + search history
"""
import hashlib
import uuid
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=DeprecationWarning)

from google import genai
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document as LCDocument
import docx

from core.config import settings
from database import Document, SearchHistory

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def _load_docx_with_pages(file_path: str) -> list:
    """
    Loads a DOCX file and tracks page numbers by detecting page break
    elements (w:pageBreak and w:lastRenderedPageBreak) in the XML.
    Returns a list of LangChain Document objects with page metadata.
    """
    doc      = docx.Document(file_path)
    pages    = []
    cur_page = 0
    cur_text = []

    for para in doc.paragraphs:
        # Check for page breaks — 'w:br' present AND 'page' in the XML
        xml = para._element.xml
        if 'w:br' in xml and 'page' in xml:
            if cur_text:
                pages.append(LCDocument(
                    page_content="\n".join(cur_text).strip(),
                    metadata={"page": cur_page, "source": file_path}
                ))
            cur_page += 1
            cur_text = []

        text = para.text.strip()
        if text:
            cur_text.append(text)

    # Add last page
    if cur_text:
        pages.append(LCDocument(
            page_content="\n".join(cur_text).strip(),
            metadata={"page": cur_page, "source": file_path}
        ))

    return pages if pages else [LCDocument(
        page_content="\n".join(p.text for p in doc.paragraphs if p.text.strip()),
        metadata={"page": 0, "source": file_path}
    )]

LLM_MODEL       = "gemini-2.5-flash"
EMBEDDING_MODEL = "models/gemini-embedding-001"


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


class GeminiEmbeddings(Embeddings):
    """
    Embedding class using Gemini embedding-001.
    Batches all chunks into ONE API call instead of one per chunk —
    dramatically faster for multi-chunk documents.
    """
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        client = _get_client()
        # Single batch API call for ALL texts at once
        try:
            r = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=texts   # pass all texts together
            )
            return [e.values for e in r.embeddings]
        except Exception:
            # Fallback: one by one if batch fails
            result = []
            for text in texts:
                r = client.models.embed_content(model=EMBEDDING_MODEL, contents=text)
                result.append(r.embeddings[0].values)
            return result

    def embed_query(self, text: str) -> list[float]:
        client = _get_client()
        r = client.models.embed_content(model=EMBEDDING_MODEL, contents=text)
        return r.embeddings[0].values


def _generate_answer(context: str, question: str) -> str:
    """Calls Gemini 2.5 Flash to generate an answer. Retries on 429 quota errors."""
    import time
    from google.genai import errors as genai_errors

    client = _get_client()
    prompt = f"""You are a helpful assistant that answers questions strictly based on the document content below.

Context from the document:
{context}

Question: {question}

Instructions:
- Answer only using the information from the context above.
- If the answer is not found, say: "I could not find this information in the document."
- Be concise and accurate.

Answer:"""

    for attempt in range(3):
        try:
            response = client.models.generate_content(model=LLM_MODEL, contents=prompt)
            return response.text
        except genai_errors.ClientError as e:
            if '429' in str(e) and attempt < 2:
                wait = 15 * (attempt + 1)   # wait 15s, then 30s
                time.sleep(wait)
                continue
            raise HTTPException(
                status_code=429,
                detail="Gemini API daily quota exceeded (20 requests/day on free tier). Please wait until tomorrow or upgrade your Google AI plan at https://ai.google.dev"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


async def index_document(file: UploadFile, db: Session) -> dict:
    """
    Phase 1: Index a document into ChromaDB.
    Extracts text → splits into chunks → creates embeddings → stores in vector DB.
    Returns document metadata so the frontend can move to the Q&A phase.
    """
    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not set.")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".docx"]:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    file_bytes = await file.read()
    file_hash  = _sha256(file_bytes)
    embeddings = GeminiEmbeddings()

    # Return immediately if already indexed
    existing = db.query(Document).filter(Document.file_hash == file_hash).first()
    if existing:
        return {
            "document_id":   existing.id,
            "document_name": existing.filename,
            "chunk_count":   existing.chunk_count,
            "already_indexed": True,
            "message": f"'{existing.filename}' was already indexed. Ready to answer questions."
        }

    # Save temp file
    temp_path = UPLOAD_DIR / f"{uuid.uuid4()}{ext}"
    temp_path.write_bytes(file_bytes)
    try:
        if ext == ".pdf":
            documents = PyPDFLoader(str(temp_path)).load()
        else:
            documents = _load_docx_with_pages(str(temp_path))
    finally:
        if temp_path.exists():
            temp_path.unlink()

    if not documents:
        raise HTTPException(status_code=400, detail="Could not extract text from the document.")

    # Split → embed → store
    chunks = RecursiveCharacterTextSplitter(
        chunk_size=1000, chunk_overlap=200
    ).split_documents(documents)

    collection_name = f"doc_{uuid.uuid4().hex[:12]}"
    Chroma.from_documents(
        chunks, embeddings,
        collection_name=collection_name,
        persist_directory=settings.CHROMA_PERSIST_DIR
    )

    # Save metadata to PostgreSQL
    doc_record = Document(
        filename=file.filename,
        file_hash=file_hash,
        collection_name=collection_name,
        chunk_count=len(chunks)
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    return {
        "document_id":     doc_record.id,
        "document_name":   doc_record.filename,
        "chunk_count":     doc_record.chunk_count,
        "already_indexed": False,
        "message": f"'{doc_record.filename}' indexed into {len(chunks)} chunks. Ready to answer questions."
    }


async def run_knowledge_search(file: UploadFile, question: str, db: Session) -> dict:

    if not settings.GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not set.")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".docx"]:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    file_bytes = await file.read()
    file_hash  = _sha256(file_bytes)

    embeddings = GeminiEmbeddings()

    # Check if document already processed
    existing_doc = db.query(Document).filter(Document.file_hash == file_hash).first()

    if existing_doc:
        vectorstore = Chroma(
            collection_name=existing_doc.collection_name,
            embedding_function=embeddings,
            persist_directory=settings.CHROMA_PERSIST_DIR
        )
    else:
        # Save temp file and extract text
        temp_path = UPLOAD_DIR / f"{uuid.uuid4()}{ext}"
        temp_path.write_bytes(file_bytes)
        try:
            loader    = PyPDFLoader(str(temp_path)) if ext == ".pdf" else Docx2txtLoader(str(temp_path))
            documents = loader.load()
        finally:
            if temp_path.exists():
                temp_path.unlink()

        if not documents:
            raise HTTPException(status_code=400, detail="Could not extract text from the document.")

        chunks = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200
        ).split_documents(documents)

        collection_name = f"doc_{uuid.uuid4().hex[:12]}"
        vectorstore = Chroma.from_documents(
            chunks,
            embeddings,
            collection_name=collection_name,
            persist_directory=settings.CHROMA_PERSIST_DIR
        )

        doc_record = Document(
            filename=file.filename,
            file_hash=file_hash,
            collection_name=collection_name,
            chunk_count=len(chunks)
        )
        db.add(doc_record)
        db.commit()
        db.refresh(doc_record)
        existing_doc = doc_record

    # Retrieve relevant chunks
    retriever   = vectorstore.as_retriever(search_kwargs={"k": 4})
    source_docs = retriever.invoke(question)
    context     = "\n\n".join(doc.page_content for doc in source_docs)

    # Generate answer
    answer = _generate_answer(context, question)

    # Collect all unique page numbers from retrieved chunks
    pages = sorted(set(
        int(d.metadata["page"]) + 1
        for d in source_docs
        if d.metadata.get("page") is not None
    ))

    if pages:
        page_str = ", ".join(f"Page {p}" for p in pages)
        source = f"{file.filename} — {page_str}"
    else:
        source = file.filename

    # Save to search_history
    db.add(SearchHistory(
        document_id=existing_doc.id,
        question=question,
        answer=answer,
        source=source
    ))
    db.commit()

    return {
        "document_id":   existing_doc.id,
        "document_name": existing_doc.filename,
        "answer":        answer,
        "source":        source,
        "pages":         pages,
    }


async def run_query_by_document_id(document_id: int, question: str, db: Session) -> dict:
    """
    Query an already-processed document by its PostgreSQL ID.
    Loads the existing ChromaDB collection — no file upload needed.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    embeddings  = GeminiEmbeddings()
    vectorstore = Chroma(
        collection_name=doc.collection_name,
        embedding_function=embeddings,
        persist_directory=settings.CHROMA_PERSIST_DIR
    )

    retriever   = vectorstore.as_retriever(search_kwargs={"k": 4})
    source_docs = retriever.invoke(question)
    context     = "\n\n".join(d.page_content for d in source_docs)
    answer      = _generate_answer(context, question)

    pages = sorted(set(
        int(d.metadata["page"]) + 1
        for d in source_docs
        if d.metadata.get("page") is not None
    ))

    if pages:
        page_str = ", ".join(f"Page {p}" for p in pages)
        source = f"{doc.filename} — {page_str}"
    else:
        source = doc.filename

    db.add(SearchHistory(
        document_id=doc.id,
        question=question,
        answer=answer,
        source=source
    ))
    db.commit()

    return {
        "document_id":   doc.id,
        "document_name": doc.filename,
        "answer":        answer,
        "source":        source,
        "pages":         pages,
    }
