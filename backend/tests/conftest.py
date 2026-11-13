"""Pytest fixtures and configuration."""

import pytest
from starlette.testclient import TestClient
from app.main import app
from app.config import settings
from app.services.cache_service import cache_service


@pytest.fixture(autouse=True)
def clear_cache():
    """Ensure query cache is clean before every test."""
    cache_service.invalidate_all()
    yield
    cache_service.invalidate_all()


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)
