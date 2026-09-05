"""Image-processing pipeline.

Keep image algorithms independent of FastAPI so they can be unit tested
without starting a web server.
"""
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError, ImageFilter, ImageDraw, ImageFont

import numpy as np

import cv2

from typing import cast

# def convert_to_png(image_bytes: bytes) -> bytes:
#     try:
#         with Image.open(BytesIO(image_bytes)) as image:
#             image.load()
#
#             normalized_image = ImageOps.exif_transpose(image)
#             normalized_image = normalized_image.convert("RGB")
#
#             output_buffer = BytesIO()
#             normalized_image.save(output_buffer, format="PNG")
#
#             return output_buffer.getvalue()
#
#     except (UnidentifiedImageError, OSError) as error:
#         raise ValueError("The uploaded file is not a valid image") from error

def process(image_bytes: bytes, color_count: int = 12, median_filter_size: int = 7, merge_area = 200) -> tuple[bytes, bytes, list[tuple[int, tuple[int, int, int]]]]:
    reduced_image = reduce_colors(image_bytes, color_count, median_filter_size, merge_area)
    color_keys, locations = locate_numbers(reduced_image)

    boundary = find_boundary(reduced_image)

    height, width = boundary.shape
    outlined_array = np.full((height, width, 3), 255, dtype=np.uint8)

    outlined_array[boundary] = (0, 0, 0)

    outlined_image = Image.fromarray(outlined_array)

    numbered_image = draw_numbers(outlined_image, locations)

    numbered_buffer = BytesIO()
    numbered_image.save(numbered_buffer, format="PNG")
    expected_buffer = BytesIO()
    reduced_image.save(expected_buffer, format="PNG")

    return numbered_buffer.getvalue(), expected_buffer.getvalue(), color_keys

def reduce_colors(image_bytes: bytes, color_count: int = 12, median_filter_size: int = 7, merge_area = 200) -> Image.Image:
    if not (2 <= color_count <= 50 and median_filter_size % 2 == 1):
        raise ValueError("color_count must be between 2 and 50")
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

            smoothed_image = normalized_image.filter(ImageFilter.MedianFilter(size=median_filter_size))

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

            return cleaned_image

    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("The uploaded file is not a valid image") from error

def merge_small_regions(image: Image.Image, min_area: int = 200, max_passes: int = 3) -> Image.Image:
    if image.mode != "P":
        raise ValueError("quantized_image must be a palette image")

    if min_area < 1:
        raise ValueError("min_area must be at least 1")

    labels = np.asarray(image).copy()

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

    palette = image.getpalette()

    if palette is not None:
        cleaned_image.putpalette(palette)

    return cleaned_image

def find_boundary(image: Image.Image) -> np.ndarray:
    if image.mode != "P":
        raise ValueError("quantized_image must be a palette image")

    color_labels = np.asarray(image)
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

def draw_numbers(image: Image.Image, locations: list[tuple[float, float, int]]) -> Image.Image:

    numbered_image = image.copy()

    draw = ImageDraw.Draw(numbered_image)

    font = ImageFont.load_default(size=7)

    for x, y, number in locations:
        draw.text((x, y), str(number), fill=(0, 0, 0), font=font, anchor="mm")

    return numbered_image

def locate_numbers(image: Image.Image) -> tuple[list[tuple[int, tuple[int, int, int]]], list[tuple[float, float, int]]]:
    if image.mode != "P":
        raise ValueError("quantized_image must be a palette image")

    labels = np.asarray(image).copy()
    color_keys, locations = [], []
    palette = image.getpalette()

    if palette is None:
        raise ValueError("quantized_image does not contain a color palette")

    for color_number, color_label in enumerate(np.unique(labels), start=1):
        palette_index = int(color_label) * 3
        rgb = tuple(palette[palette_index:palette_index + 3])
        color_keys.append((color_number, rgb))

        color_mask = (labels == color_label).astype(np.uint8)

        component_count, component_ids, component_stats, component_centroids = (
            cv2.connectedComponentsWithStats(color_mask, connectivity=4)
        )

        for component in range(1, component_count):
            left = int(component_stats[component, cv2.CC_STAT_LEFT])
            top = int(component_stats[component, cv2.CC_STAT_TOP])
            width = int(component_stats[component, cv2.CC_STAT_WIDTH])
            height = int(component_stats[component, cv2.CC_STAT_HEIGHT])

            component_mask = (
                    component_ids[
                        top:top + height,
                        left:left + width,
                    ] == component
            ).astype(np.uint8)

            padded_mask = np.pad(
                component_mask,
                pad_width=((1, 1), (1, 1)),
                mode="constant",
                constant_values=0,
            ).astype(np.uint8, copy=False)

            distance_map = cv2.distanceTransform(padded_mask, cv2.DIST_L2, 5)

            _, _, _, maximum_location = cv2.minMaxLoc(distance_map)
            padded_x, padded_y = maximum_location

            x = left + padded_x - 1
            y = top + padded_y - 1

            locations.append((float(x), float(y), color_number))

    return color_keys, locations
