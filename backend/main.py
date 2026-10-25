from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os

from config import settings
from database import init_db
from routes.auth import router as auth_router
from routes.affordability import router as affordability_router
from routes.copilot import router as copilot_router
from routes.documents import router as documents_router
from routes.insurance import router as insurance_router
from routes.journeys import router as journeys_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Intelligent Financial Journey Assistant API for Lending, Insurance, Document Intelligence and Affordability Analysis."
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development/hackathon, allow all frontend origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to ensure DB and demo records exist
@app.on_event("startup")
def on_startup():
    init_db()

# Health check endpoint
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "online",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected (SQLite/Supabase ready)",
        "features": {
            "ai_copilot": True,
            "affordability_analyzer": True,
            "document_intelligence": True,
            "insurance_simplifier": True,
            "journey_tracker": True,
            "simulated_underwriting": True
        }
    }

# Include all route groups under /api
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(affordability_router, prefix=settings.API_PREFIX)
app.include_router(copilot_router, prefix=settings.API_PREFIX)
app.include_router(documents_router, prefix=settings.API_PREFIX)
app.include_router(insurance_router, prefix=settings.API_PREFIX)
app.include_router(journeys_router, prefix=settings.API_PREFIX)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
