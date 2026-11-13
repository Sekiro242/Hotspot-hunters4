"""NASA FIRMS API Client.

Responsible for:
- Authentication via FIRMS_MAP_KEY (loaded securely from settings).
- Request construction and validation.
- Retry handling with exponential backoff.
- Rate-limit handling (5,000 requests / 10-minute sliding window).
- Timeout handling.
- Response validation and sanitized error reporting.

CRITICAL SECURITY REQUIREMENT:
The MAP_KEY is NEVER logged, printed, serialized, or included in error messages.
"""

from __future__ import annotations

import logging
import time
from typing import Optional, Dict, Any, List
import httpx

from app.config import settings
from app.core.exceptions import (
    FIRMSAuthError,
    FIRMSRateLimitError,
    FIRMSTimeoutError,
    FIRMSClientError,
)

logger = logging.getLogger(__name__)


class NASA_FIRMS_Client:
    """Client for interacting with the official NASA FIRMS REST API."""

    def __init__(
        self,
        map_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
    ):
        self._map_key = map_key or settings.FIRMS_MAP_KEY
        self.base_url = (base_url or settings.FIRMS_BASE_URL).rstrip("/")
        self.timeout = timeout_seconds or settings.FIRMS_REQUEST_TIMEOUT_SECONDS
        self.max_retries = max_retries or settings.FIRMS_MAX_RETRIES

    @property
    def has_valid_key(self) -> bool:
        """Check if a MAP_KEY appears to be configured without revealing it."""
        return bool(
            self._map_key
            and self._map_key.strip()
            and self._map_key != "your_nasa_firms_map_key_here"
        )

    def _sanitize_url(self, url: str) -> str:
        """Strip the secret MAP_KEY from any URL before logging or displaying."""
        if self._map_key and self._map_key in url:
            return url.replace(self._map_key, "[REDACTED_MAP_KEY]")
        return url

    def _execute_request(self, endpoint_path: str) -> str:
        """Execute an HTTP GET request to FIRMS with retries and sanitized error reporting."""
        if not self.has_valid_key:
            raise FIRMSAuthError(
                "NASA FIRMS MAP_KEY is not configured. Set the FIRMS_MAP_KEY environment variable."
            )

        full_url = f"{self.base_url}/{endpoint_path.lstrip('/')}"
        sanitized_url = self._sanitize_url(full_url)
        logger.debug(f"Executing FIRMS request: {sanitized_url}")

        attempt = 0
        backoff = 1.0

        while attempt < self.max_retries:
            attempt += 1
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.get(full_url, follow_redirects=True)

                # Check HTTP status
                if response.status_code == 200:
                    text = response.text
                    # NASA FIRMS sometimes returns HTTP 200 with an error string like "Invalid MAP_KEY."
                    if "Invalid MAP_KEY" in text:
                        raise FIRMSAuthError("NASA FIRMS reported an invalid MAP_KEY.")
                    if "No fire detected" in text or "no fire detected" in text.lower():
                        # Valid empty response from FIRMS
                        return ""
                    return text

                elif response.status_code == 400:
                    text = response.text
                    if "Invalid MAP_KEY" in text or "MAP_KEY" in text:
                        raise FIRMSAuthError("NASA FIRMS rejected the MAP_KEY as invalid or expired.")
                    raise FIRMSClientError(f"Bad Request: {text.strip()}", status_code=400)

                elif response.status_code == 401 or response.status_code == 403:
                    raise FIRMSAuthError("Authentication failed against NASA FIRMS.")

                elif response.status_code == 429:
                    if attempt < self.max_retries:
                        sleep_time = backoff * (2 ** (attempt - 1))
                        logger.warning(f"FIRMS rate limit encountered. Retrying in {sleep_time:.1f}s...")
                        time.sleep(sleep_time)
                        continue
                    raise FIRMSRateLimitError()

                elif response.status_code >= 500:
                    if attempt < self.max_retries:
                        sleep_time = backoff * (2 ** (attempt - 1))
                        logger.warning(f"FIRMS server error ({response.status_code}). Retrying in {sleep_time:.1f}s...")
                        time.sleep(sleep_time)
                        continue
                    raise FIRMSClientError(f"FIRMS server returned {response.status_code}.", status_code=response.status_code)

                else:
                    raise FIRMSClientError(f"Unexpected response code {response.status_code}", status_code=response.status_code)

            except httpx.TimeoutException as exc:
                if attempt < self.max_retries:
                    time.sleep(backoff)
                    continue
                raise FIRMSTimeoutError(f"FIRMS request timed out after {self.timeout}s.") from exc
            except (FIRMSAuthError, FIRMSRateLimitError, FIRMSClientError):
                raise
            except Exception as exc:
                if attempt < self.max_retries:
                    time.sleep(backoff)
                    continue
                raise FIRMSClientError(f"Connection to NASA FIRMS failed: {type(exc).__name__}") from exc

        raise FIRMSClientError("Maximum retries exceeded while calling NASA FIRMS.")

    def get_area_csv(
        self,
        source: str,
        west: float,
        south: float,
        east: float,
        north: float,
        day_range: int = 1,
        date: Optional[str] = None,
    ) -> str:
        """Query the Area Fire Detections API returning raw CSV.

        Parameters:
            source: e.g. 'MODIS_NRT', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'
            west, south, east, north: bounding box coordinates
            day_range: 1 to 5 days
            date: anchor date in YYYY-MM-DD (optional, defaults to current date)
        """
        day_range = max(1, min(day_range, 5))
        area_str = f"{west},{south},{east},{north}"
        if date:
            path = f"api/area/csv/{self._map_key}/{source}/{area_str}/{day_range}/{date}"
        else:
            path = f"api/area/csv/{self._map_key}/{source}/{area_str}/{day_range}"

        return self._execute_request(path)

    def get_data_availability(self, sensor: str = "all") -> str:
        """Query data availability CSV from NASA FIRMS.

        Parameters:
            sensor: 'all', 'MODIS_NRT', 'VIIRS_SNPP_NRT', etc.
        """
        path = f"api/data_availability/csv/{self._map_key}/{sensor}"
        return self._execute_request(path)
