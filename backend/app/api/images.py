from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response
from app.services.image_processor import convert_to_png

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
        png_bytes = convert_to_png(image_bytes)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    return Response(
        content=png_bytes,
        media_type="image/png",
    )
