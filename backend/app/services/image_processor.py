"""Image-processing pipeline.

Keep image algorithms independent of FastAPI so they can be unit tested
without starting a web server.
"""
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError, ImageFilter

import numpy as np

import cv2



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


def reduce_colors(image_bytes: bytes, color_count: int = 12, smooth_median: int = 7, merge_area = 200) -> bytes:
    if not (2 <= color_count <= 32 and smooth_median % 2 == 1):
        raise ValueError("color_count must be between 2 and 32")
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.load()

            oriented_image = ImageOps.exif_transpose(image)

            rgba_image = oriented_image.convert("RGBA")

            white_background = Image.new(
                "RGBA",
                rgba_image.size,
                (255, 255, 255, 255),
            )

            normalized_image = Image.alpha_composite(
                white_background,
                rgba_image,
            ).convert("RGB")

            smoothed_image = normalized_image.filter(ImageFilter.MedianFilter(size=smooth_median))

            quantized_image = smoothed_image.quantize(
                colors=color_count,
                method=Image.Quantize.MAXCOVERAGE,
                kmeans=3,
                dither=Image.Dither.NONE,
            )

            cleaned_image = merge_small_regions(
                quantized_image,
                min_area=merge_area,
            )

            boundary = find_boundary(cleaned_image)

            output_array = np.array(
                cleaned_image.convert("RGB")
            )

            output_array[boundary] = (0, 0, 0)

            output_image = Image.fromarray(output_array)

            # output_image = quantized_image.convert("RGB")

            output_buffer = BytesIO()
            output_image.save(output_buffer, format="PNG")

            return output_buffer.getvalue()

    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("The uploaded file is not a valid image") from error


def find_boundary(quantized_image: Image.Image) -> np.ndarray:
    color_labels = np.asarray(quantized_image)
    boundaries = np.zeros(color_labels.shape, dtype=bool)

    vertical_changes = (
            color_labels[:, 1:] != color_labels[:, :-1]
    )
    boundaries[:, 1:] |= vertical_changes
    boundaries[:, :-1] |= vertical_changes

    horizontal_changes = (
            color_labels[1:, :] != color_labels[:-1, :]
    )
    boundaries[1:, :] |= horizontal_changes
    boundaries[:-1, :] |= horizontal_changes

    return boundaries

def merge_small_regions(quantized_image: Image.Image, min_area: int = 200, max_passes: int = 3) -> Image.Image:
    if quantized_image.mode != "P":
        raise ValueError("quantized_image must be a palette image")

    if min_area < 1:
        raise ValueError("min_area must be at least 1")

    labels = np.asarray(quantized_image).copy()

    # Only treat pixels sharing an edge as neighbors.
    neighbor_kernel = np.array(
        [
            [0, 1, 0],
            [1, 1, 1],
            [0, 1, 0],
        ],
        dtype=np.uint8,
    )

    for _ in range(max_passes):
        changed = False

        for color_label in np.unique(labels):
            color_mask = (labels == color_label).astype(np.uint8)

            (
                component_count,
                component_ids,
                component_stats,
                _,
            ) = cv2.connectedComponentsWithStats(
                color_mask,
                connectivity=4,
            )

            # Component 0 represents everything outside this color.
            for component_id in range(1, component_count):
                area = component_stats[
                    component_id,
                    cv2.CC_STAT_AREA,
                ]

                if area >= min_area:
                    continue

                small_region = component_ids == component_id

                expanded_region = cv2.dilate(
                    small_region.astype(np.uint8),
                    neighbor_kernel,
                    iterations=1,
                ).astype(bool)

                surrounding_pixels = expanded_region & ~small_region
                neighboring_labels = labels[surrounding_pixels]

                # Do not replace the region with its current color.
                neighboring_labels = neighboring_labels[
                    neighboring_labels != color_label
                    ]

                if neighboring_labels.size == 0:
                    continue

                labels_found, label_counts = np.unique(
                    neighboring_labels,
                    return_counts=True,
                )

                replacement_label = labels_found[
                    np.argmax(label_counts)
                ]

                labels[small_region] = replacement_label
                changed = True

        if not changed:
            break

    cleaned_image = Image.fromarray(
        labels.astype(np.uint8),
        mode="P",
    )

    palette = quantized_image.getpalette()

    if palette is not None:
        cleaned_image.putpalette(palette)

    return cleaned_image
