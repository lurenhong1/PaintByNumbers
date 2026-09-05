from fastapi import APIRouter, HTTPException, UploadFile
import base64
from app.services.image_processor import process

router = APIRouter(
    prefix="/images",
    tags=["images"],
)

@router.post("/process")
async def process_image(image: UploadFile):
    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty",
        )

    try:
        numbered_bytes, expected_bytes, color_keys = process(image_bytes, color_count=20, smooth_median=9, merge_area=800)
        return {
            "numberedImage": base64.b64encode(numbered_bytes).decode("ascii"),
            "expectedImage": base64.b64encode(expected_bytes).decode("ascii"),
            "colorKeys": color_keys,
        }
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


