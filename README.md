# AI Workplace Assistant

A unified AI platform for workplace productivity.

## Modules
- **Knowledge Search** — RAG-powered document Q&A
- **Contract Analyzer** — AI contract risk detection
- **Email Reply** — AI email reply generator

## Tech Stack
- Frontend: Next.js 16, Tailwind CSS
- Backend: FastAPI, Python 3.10
- Database: PostgreSQL
- AI: Google Gemini 2.5-flash
- Vector DB: ChromaDB

## Environment Variables (Backend)
```
GOOGLE_API_KEY=your_google_api_key
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=your_secret_key
```

## Run Locally

### Backend
```bash
cd Backend
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd Frontend
npm install
npm run dev
```
