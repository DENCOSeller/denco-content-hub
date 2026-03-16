from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message=message, status_code=404)


class ConflictException(AppException):
    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(message=message, status_code=409)


class ForbiddenException(AppException):
    def __init__(self, message: str = "Access denied") -> None:
        super().__init__(message=message, status_code=403)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Not authenticated") -> None:
        super().__init__(message=message, status_code=401)


class BadRequestException(AppException):
    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(message=message, status_code=400)


class RateLimitException(AppException):
    def __init__(self, message: str = "Rate limit exceeded") -> None:
        super().__init__(message=message, status_code=429)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
        )
