"""Main FastAPI application entry point for Burn Calendar backend.

Configures:
- Application lifespan and automatic storage initialization
- CORS middleware for seamless frontend communication
- OpenAPI documentation (/docs, /redoc)
- Versioned API routes under /api/v1
- Top-level /health check
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.exceptions import BurnCalendarException
from app.api.v1.analyze import router as analyze_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.summary import router as summary_router
from app.api.v1.seasonality import router as seasonality_router
from app.api.v1.sensors import router as sensors_router
from app.api.v1.quality import router as quality_router
from app.api.v1.map import router as map_router
from app.api.v1.download import router as download_router
from app.api.v1.methodology import router as methodology_router
from app.api.v1.health import router as health_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("burn_calendar")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: ensure directories and inspect storage."""
    settings.ensure_directories()
    logger.info("Burn Calendar backend initialized.")
    yield
    logger.info("Burn Calendar backend shutting down.")


app = FastAPI(
    title="Burn Calendar API",
    description=(
        "Global geospatial fire-activity analysis platform developed for the NASA Space Apps Challenge 2026. "
        "Harmonizes MODIS and VIIRS satellite active fire observations across arbitrary geographic areas."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware allowing the Vite React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",  # Permissive for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom exception handler ensuring no secrets leak
@app.exception_handler(BurnCalendarException)
async def burn_calendar_exception_handler(request: Request, exc: BurnCalendarException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "message": exc.message, "details": exc.details},
    )

# Mount top-level health endpoint
app.include_router(health_router)

# Mount versioned API v1 endpoints
api_v1_prefix = settings.API_V1_PREFIX
app.include_router(analyze_router, prefix=api_v1_prefix)
app.include_router(calendar_router, prefix=api_v1_prefix)
app.include_router(summary_router, prefix=api_v1_prefix)
app.include_router(seasonality_router, prefix=api_v1_prefix)
app.include_router(sensors_router, prefix=api_v1_prefix)
app.include_router(quality_router, prefix=api_v1_prefix)
app.include_router(map_router, prefix=api_v1_prefix)
app.include_router(download_router, prefix=api_v1_prefix)
app.include_router(methodology_router, prefix=api_v1_prefix)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
