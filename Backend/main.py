import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import create_tables
from auth.router import router as auth_router
from modules.knowledge_search.router import router as ks_router
from modules.contract_analyzer.router import router as ca_router
from modules.email_reply.router import router as er_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title="AI Workplace Assistant API",
    description="Backend for Knowledge Search, Contract Analyzer, and Email Reply modules.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # allow all origins during development
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(tb)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb}
    )

app.include_router(auth_router, prefix="/api/auth",  tags=["Auth"])
app.include_router(ks_router,   prefix="/api",        tags=["Knowledge Search"])
app.include_router(ca_router,   prefix="/api",        tags=["Contract Analyzer"])
app.include_router(er_router,   prefix="/api",        tags=["Email Reply"])

@app.get("/", tags=["Health"])
def root():
    return {"status": "running", "message": "AI Workplace Assistant API"}
