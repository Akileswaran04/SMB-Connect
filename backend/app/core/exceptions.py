
from fastapi import HTTPException, status


class TechnovaException(Exception):
    pass


class NotFoundException(TechnovaException):
    def __init__(self, resource: str, resource_id: str):
        self.resource = resource
        self.resource_id = resource_id
        super().__init__(f"{resource} with id '{resource_id}' not found")


class ConflictException(TechnovaException):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class ValidationException(TechnovaException):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class UnauthorizedException(TechnovaException):
    def __init__(self, message: str = "Authentication required"):
        self.message = message
        super().__init__(message)


class ForbiddenException(TechnovaException):
    def __init__(self, message: str = "Insufficient permissions"):
        self.message = message
        super().__init__(message)


def not_found_exception(resource: str, resource_id: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{resource} with id '{resource_id}' not found",
    )


def conflict_exception(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=message,
    )


def validation_exception(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=message,
    )
