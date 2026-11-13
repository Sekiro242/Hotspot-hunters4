"""Analysis endpoint for arbitrary AOIs, historical dates, and multi-sensor queries."""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, status

from app.models.analysis import AnalysisRequest, AnalysisResponse, JobStatusResponse
from app.services.analysis_service import analysis_service
from app.services.job_service import job_service
from app.core.exceptions import BurnCalendarException

router = APIRouter(prefix="", tags=["Analysis"])


def _run_async_analysis(job_id: str, request: AnalysisRequest) -> None:
    """Execute analysis in background task and record outcome."""
    try:
        job_service.update_progress(job_id, 0.2, status="running")
        response = analysis_service.execute_analysis(request)
        job_service.complete_job(job_id, response)
    except Exception as e:
        job_service.fail_job(job_id, str(e))


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    responses={
        200: {"description": "Synchronous analysis completed."},
        202: {"model": JobStatusResponse, "description": "Asynchronous job accepted."},
    },
    summary="Submit an AOI analysis query",
)
def submit_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    async_mode: bool = Query(default=False, description="Force background execution"),
):
    """Analyze fire activity for an arbitrary AOI (bounding box or polygon) and date range.

    - Small to moderate date ranges (<= 366 days) execute synchronously by default.
    - If `async_mode=True`, returns 202 Accepted with a job_id to poll.
    """
    try:
        d_start = date.fromisoformat(request.start_date)
        d_end = date.fromisoformat(request.end_date)
        if d_start > d_end:
            raise HTTPException(status_code=422, detail="start_date cannot be later than end_date.")

        days = (d_end - d_start).days + 1

        if async_mode or days > 366:
            job_id = job_service.create_job()
            background_tasks.add_task(_run_async_analysis, job_id, request)
            from fastapi.responses import JSONResponse
            status_obj = job_service.get_job_status(job_id)
            return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content=status_obj.model_dump())

        # Synchronous execution
        return analysis_service.execute_analysis(request)

    except HTTPException:
        raise
    except BurnCalendarException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(exc)}")


@router.get(
    "/analysis/{job_id}",
    response_model=JobStatusResponse,
    summary="Get background analysis job status and result",
)
def get_analysis_status(job_id: str):
    """Retrieve the status, progress, or completed result of a background analysis job."""
    try:
        return job_service.get_job_status(job_id)
    except BurnCalendarException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
