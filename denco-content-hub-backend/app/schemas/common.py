from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number")
    size: int = Field(default=20, ge=1, le=100, description="Items per page")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


class PaginatedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
