"""Image-processing pipeline.

Keep image algorithms independent of FastAPI so they can be unit tested
without starting a web server.
"""
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError


def convert_to_png(image_bytes: bytes) -> bytes:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.load()

            normalized_image = ImageOps.exif_transpose(image)
            normalized_image = normalized_image.convert("RGB")

            output_buffer = BytesIO()
            normalized_image.save(output_buffer, format="PNG")

            return output_buffer.getvalue()

    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("The uploaded file is not a valid image") from error
