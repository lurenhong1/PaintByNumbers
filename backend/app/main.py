"""FastAPI application entry point.

First task:
    Create the FastAPI application and a GET /health endpoint.
"""

from fastapi import FastAPI

app = FastAPI(
    title="Paint by Numbers API",
    version="0.1.0",
)

@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
