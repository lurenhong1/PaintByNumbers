from fastapi import APIRouter, HTTPException, UploadFile, File, Form
import base64

from app.models.schemas import ColorRecipeRequest
from app.services.color_mixer import estimate_paint_mix
from app.services.image_processor import process

from typing import Annotated

router = APIRouter(
    prefix="/images",
    tags=["images"],
)

@router.post("/process")
async def process_image(
        image: Annotated[UploadFile, File()],
        color_count: Annotated[int, Form(alias="colorCount")],
        median_filter_size: Annotated[int, Form(alias="medianFilterSize")],
        merge_area: Annotated[int, Form(alias="mergeArea")]
):
    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty",
        )

    try:
        template_bytes, reference_bytes, color_keys = process(image_bytes,
                                                             color_count=color_count,
                                                             median_filter_size=median_filter_size,
                                                             merge_area=merge_area)
        return {
            "templateImage": base64.b64encode(template_bytes).decode("ascii"),
            "referenceImage": base64.b64encode(reference_bytes).decode("ascii"),
            "colorKeys": color_keys,
        }
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.post("/recipes")
def create_color_recipes(request: ColorRecipeRequest):
    """Add an estimated RYBKW paint recipe to each numbered palette color."""
    try:
        color_keys = [
            (number, rgb, estimate_paint_mix(rgb))
            for number, rgb in request.colorKeys
        ]
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {"colorKeys": color_keys}


