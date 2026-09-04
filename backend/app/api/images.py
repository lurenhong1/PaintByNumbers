from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response
from app.services.image_processor import convert_to_png, reduce_colors

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
        png_bytes = reduce_colors(image_bytes, color_count=20, smooth_median=9, merge_area=800)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    return Response(
        content=png_bytes,
        media_type="image/png",
    )
