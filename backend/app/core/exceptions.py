"""Custom exceptions for the Burn Calendar backend.

Ensures clear error messages that NEVER leak API keys, credentials, or internal secrets.
"""


class BurnCalendarException(Exception):
    """Base exception for Burn Calendar backend."""
    def __init__(self, message: str, status_code: int = 500, details: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class FIRMSClientError(BurnCalendarException):
    """Base exception for NASA FIRMS interaction errors."""
    def __init__(self, message: str, status_code: int = 502, details: dict = None):
        super().__init__(f"NASA FIRMS API Error: {message}", status_code=status_code, details=details)


class FIRMSAuthError(FIRMSClientError):
    """Raised when FIRMS MAP_KEY is invalid or missing."""
    def __init__(self, message: str = "Invalid or unconfigured NASA FIRMS MAP_KEY."):
        super().__init__(message, status_code=401)


class FIRMSRateLimitError(FIRMSClientError):
    """Raised when FIRMS rate limit (5,000 requests / 10 min) is exceeded."""
    def __init__(self, message: str = "NASA FIRMS rate limit exceeded. Please retry later."):
        super().__init__(message, status_code=429)


class FIRMSTimeoutError(FIRMSClientError):
    """Raised when FIRMS requests time out."""
    def __init__(self, message: str = "NASA FIRMS request timed out."):
        super().__init__(message, status_code=504)


class InvalidGeometryError(BurnCalendarException):
    """Raised when AOI bounding box or polygon geometry is invalid."""
    def __init__(self, message: str):
        super().__init__(f"Invalid AOI Geometry: {message}", status_code=422)


class DataNotFoundError(BurnCalendarException):
    """Raised when requested historical data is unavailable for given sensor/dates."""
    def __init__(self, message: str):
        super().__init__(message, status_code=404)


class AnalysisJobNotFoundError(BurnCalendarException):
    """Raised when background analysis job ID is not found."""
    def __init__(self, job_id: str):
        super().__init__(f"Analysis job '{job_id}' not found.", status_code=404)
