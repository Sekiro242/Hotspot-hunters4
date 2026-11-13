"""Tests for NASA FIRMS API integration, credential security, retries, and error handling."""

import pytest
import httpx
from unittest.mock import patch, MagicMock

from app.ingestion.firms_client import NASA_FIRMS_Client
from app.core.exceptions import (
    FIRMSAuthError,
    FIRMSRateLimitError,
    FIRMSTimeoutError,
    FIRMSClientError,
)


def test_missing_firms_key_raises_auth_error():
    """Client without MAP_KEY must raise FIRMSAuthError."""
    client = NASA_FIRMS_Client(map_key=None)
    with pytest.raises(FIRMSAuthError) as exc_info:
        client.get_area_csv("MODIS_NRT", -60, -10, -50, 0)
    assert "MAP_KEY is not configured" in str(exc_info.value)


def test_dummy_default_key_rejected():
    """Client with placeholder MAP_KEY must raise FIRMSAuthError."""
    client = NASA_FIRMS_Client(map_key="your_nasa_firms_map_key_here")
    with pytest.raises(FIRMSAuthError):
        client.get_area_csv("MODIS_NRT", -60, -10, -50, 0)


def test_map_key_never_leaked_in_sanitized_url():
    """Secret MAP_KEY must never appear in logged or formatted URLs."""
    secret_key = "abc123xyz_super_secret"
    client = NASA_FIRMS_Client(map_key=secret_key)
    raw_url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{secret_key}/MODIS_NRT/world/1"
    sanitized = client._sanitize_url(raw_url)

    assert secret_key not in sanitized
    assert "[REDACTED_MAP_KEY]" in sanitized


@patch("httpx.Client.get")
def test_rate_limit_429_handling(mock_get):
    """When FIRMS returns 429, client should retry and raise FIRMSRateLimitError if exhausted."""
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.text = "Rate limit exceeded"
    mock_get.return_value = mock_response

    client = NASA_FIRMS_Client(map_key="test_key", max_retries=2)
    with pytest.raises(FIRMSRateLimitError):
        client.get_area_csv("MODIS_NRT", -60, -10, -50, 0)

    assert mock_get.call_count == 2


@patch("httpx.Client.get")
def test_timeout_handling(mock_get):
    """When requests timeout, client should raise FIRMSTimeoutError."""
    mock_get.side_effect = httpx.TimeoutException("Connection timed out")

    client = NASA_FIRMS_Client(map_key="test_key", max_retries=1)
    with pytest.raises(FIRMSTimeoutError):
        client.get_area_csv("MODIS_NRT", -60, -10, -50, 0)


@patch("httpx.Client.get")
def test_server_error_500_handling(mock_get):
    """When FIRMS returns 500, client raises FIRMSClientError."""
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_get.return_value = mock_response

    client = NASA_FIRMS_Client(map_key="test_key", max_retries=1)
    with pytest.raises(FIRMSClientError) as exc_info:
        client.get_area_csv("MODIS_NRT", -60, -10, -50, 0)
    assert "500" in str(exc_info.value)
