"""Background job management service for long-running ingestion or analysis tasks."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Dict, Optional, Callable, Any
import uuid

from app.models.analysis import JobStatusResponse, AnalysisResponse
from app.core.exceptions import AnalysisJobNotFoundError

logger = logging.getLogger(__name__)


class JobService:
    """Manages asynchronous analysis jobs with status, progress, and failure tracking."""

    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}

    def create_job(self) -> str:
        """Create a new job record and return its unique ID."""
        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        self._jobs[job_id] = {
            "job_id": job_id,
            "status": "pending",
            "progress": 0.0,
            "created_at": now,
            "updated_at": now,
            "completed_at": None,
            "error": None,
            "result": None,
        }
        return job_id

    def update_progress(self, job_id: str, progress: float, status: str = "running") -> None:
        """Update job progress fraction (0.0 to 1.0)."""
        if job_id in self._jobs:
            self._jobs[job_id]["status"] = status
            self._jobs[job_id]["progress"] = max(0.0, min(1.0, progress))
            self._jobs[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

    def complete_job(self, job_id: str, result: AnalysisResponse) -> None:
        """Mark job as successfully completed with final result."""
        if job_id in self._jobs:
            now = datetime.now(timezone.utc).isoformat()
            self._jobs[job_id]["status"] = "completed"
            self._jobs[job_id]["progress"] = 1.0
            self._jobs[job_id]["updated_at"] = now
            self._jobs[job_id]["completed_at"] = now
            self._jobs[job_id]["result"] = result

    def fail_job(self, job_id: str, error_message: str) -> None:
        """Mark job as failed with sanitized error message."""
        if job_id in self._jobs:
            now = datetime.now(timezone.utc).isoformat()
            self._jobs[job_id]["status"] = "failed"
            self._jobs[job_id]["updated_at"] = now
            self._jobs[job_id]["completed_at"] = now
            self._jobs[job_id]["error"] = error_message

    def get_job_status(self, job_id: str) -> JobStatusResponse:
        """Get status of an existing job."""
        if job_id not in self._jobs:
            raise AnalysisJobNotFoundError(job_id)
        data = self._jobs[job_id]
        return JobStatusResponse(**data)


# Global job service instance
job_service = JobService()
