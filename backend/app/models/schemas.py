"""Pydantic schemas shared by the API routes."""

from pydantic import BaseModel, Field


class ColorRecipeRequest(BaseModel):
    """Numbered RGB palette colors that need paint recipes."""

    colorKeys: list[tuple[int, tuple[int, int, int]]] = Field(
        min_length=1,
        max_length=50,
    )
