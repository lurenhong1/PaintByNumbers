"""Routes for image uploads and paint-by-numbers generation."""
from fastapi import APIRouter

from app.api.images import router as image_router

api_router = APIRouter(prefix="/api")

api_router.include_router(image_router)
