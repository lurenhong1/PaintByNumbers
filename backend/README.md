# Backend

The backend will expose a FastAPI API and contain the image-processing
pipeline.

## Responsibilities

- Validate uploaded images and processing options.
- Reduce an image to a selected color palette.
- Detect regions and create numbered outlines.
- Return generated files and palette metadata to the frontend.

The first coding task is to create the FastAPI application in `app/main.py`
and add a `GET /health` endpoint.
