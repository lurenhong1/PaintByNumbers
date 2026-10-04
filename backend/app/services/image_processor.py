"""Image-processing pipeline.

Keep image algorithms independent of FastAPI so they can be unit tested
without starting a web server.
"""
import math
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError, ImageFilter, ImageDraw, ImageFont
import numpy as np
import cv2
from app.services.thin_space_remover import perform_merge_operation, \
    remove_short_runs
from functools import lru_cache

REFERENCE_PIXELS = 1_000_000
BASE_FILTER_RADIUS = 1
BASE_MERGE_AREA = 100
MAX_OUTPUT_PIXELS = 10000

NUMBER_FONT_PATH = "C:/Windows/Fonts/segoeuisl.ttf"
MIN_FONT_SIZE = 11
MAX_FONT_SIZE = 48
MAX_FIT_SIDE = 128
TEXT_PADDING = 1

@lru_cache(maxsize=MAX_FONT_SIZE - MIN_FONT_SIZE + 1)
def get_number_font(size: int):
    return ImageFont.truetype(NUMBER_FONT_PATH, size)

def make_font_table(numbers: range) -> dict[int, int]:
    required_sides = {}

    for size in range(MIN_FONT_SIZE, MAX_FONT_SIZE + 1):
        font = get_number_font(size)

        required_sides[size] = max(
            2 * max(-left, -top, right, bottom)
            + 2 * TEXT_PADDING
            for number in numbers
            for left, top, right, bottom in [
                font.getbbox(str(number), anchor="mm")
            ]
        )

    return {
        side: max(
            (
                size
                for size, required in required_sides.items()
                if required <= side
            ),
            default=MIN_FONT_SIZE,
        )
        for side in range(MAX_FIT_SIDE + 1)
    }


ONE_CHAR_FONT_BY_SIDE = make_font_table(range(1, 10))
TWO_CHAR_FONT_BY_SIDE = make_font_table(range(10, 51))

MIN_BRUSH_WIDTH_MM = 1.0

def process(
        image_bytes: bytes,
        color_count: int = 12,
        filter_level: int = 3,
        merge_level: int = 5,
        output_dimension: tuple[int, int] | None = None,
        ppi: int = 300
) -> tuple[bytes, bytes, list[tuple[int, tuple[int, int, int]]]]:
    reference_image = reduce_colors(image_bytes, color_count, filter_level, merge_level, output_dimension, ppi)
    color_keys, locations = locate_numbers(reference_image)

    boundary = find_boundary(reference_image)

    height, width = boundary.shape
    outlined_array = np.full((height, width, 3), 255, dtype=np.uint8)

    outlined_array[boundary] = (220, 220, 220)

    outlined_image = Image.fromarray(outlined_array)

    template_image = draw_numbers(outlined_image, locations)

    template_buffer = BytesIO()
    template_image.save(template_buffer, format="PNG")
    reference_buffer = BytesIO()
    reference_image.save(reference_buffer, format="PNG")

    return template_buffer.getvalue(), reference_buffer.getvalue(), color_keys

def validate_output_size(output_size: tuple[int, int],) -> None:
    width, height = output_size

    if not (1 <= width <= MAX_OUTPUT_PIXELS and 1 <= height <= MAX_OUTPUT_PIXELS):
        raise ValueError(
            "Output width and height must be between 1 and 10000"
        )

def reduce_colors(
        image_bytes: bytes,
        color_count: int = 12,
        filter_level: int = 3,
        merge_level: int = 5,
        output_dimension: tuple[int, int] | None = None,
        ppi: int = 300
) -> Image.Image:
    if output_dimension is not None:
        validate_output_size(output_dimension)
    if not (2 <= color_count <= 50):
        raise ValueError("color_count must be between 2 and 50")
    if not 1 <= filter_level <= 5:
        raise ValueError("filter_level must be between 1 and 5")
    if not 1 <= merge_level <= 10:
        raise ValueError("merge_level must be between 1 and 10")
    if not ppi > 0:
        raise ValueError("ppi must be positive")

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

            if output_dimension is not None:
                normalized_image = normalized_image.resize(
                    output_dimension,
                    resample=Image.Resampling.LANCZOS
                )

            width, height = normalized_image.size
            area_ratio = (width * height) / REFERENCE_PIXELS
            linear_ratio = math.sqrt(area_ratio)

            filter_radius = max(1, round(BASE_FILTER_RADIUS * linear_ratio * filter_level))
            effective_filter_size = min(21, 2 * filter_radius + 1)
            effective_merge_area = max(1, round(BASE_MERGE_AREA * area_ratio * merge_level))

            smoothed_image = normalized_image.filter(ImageFilter.MedianFilter(size=effective_filter_size))

            quantized_image = smoothed_image.quantize(
                colors=color_count,
                method=Image.Quantize.MAXCOVERAGE,
                kmeans=3,
                dither=Image.Dither.NONE,
            )

            region_cleaned_image = merge_small_regions(
                quantized_image,
                min_area=effective_merge_area,
            )

            # run_cleaned_image = perform_merge_operation(region_cleaned_image, math.ceil(MIN_BRUSH_WIDTH_MM * ppi / 25.4))
            # run_cleaned_image = remove_short_runs(region_cleaned_image, math.ceil(MIN_BRUSH_WIDTH_MM * ppi / 25.4), max_iter=1)

            return region_cleaned_image

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
    # boundaries[:, :-1] |= vertical_changes

    horizontal_changes = (
            color_labels[1:, :] != color_labels[:-1, :]
    )
    boundaries[1:, :] |= horizontal_changes
    # boundaries[:-1, :] |= horizontal_changes

    return boundaries

def draw_numbers(image: Image.Image, locations: list[tuple[float, float, int, int]]) -> Image.Image:
    numbered_image = image.copy()

    draw = ImageDraw.Draw(numbered_image)

    for x, y, number, font_size in locations:
        draw.text(
            (x, y),
            str(number),
            fill=(150, 150, 150),
            font=get_number_font(font_size),
            anchor="mm",
        )

    return numbered_image

def locate_numbers(image: Image.Image) -> tuple[list[tuple[int, tuple[int, int, int]]], list[tuple[float, float, int, int]]]:
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

            _, max_radius, _, maximum_location = cv2.minMaxLoc(distance_map)
            padded_x, padded_y = maximum_location

            x = left + padded_x - 1
            y = top + padded_y - 1

            fit_side = int(math.floor(math.sqrt(2) * max_radius))
            table = (ONE_CHAR_FONT_BY_SIDE if color_number < 10 else TWO_CHAR_FONT_BY_SIDE)

            font_size = table[max(0, min(fit_side, MAX_FIT_SIDE))]

            locations.append((float(x), float(y), color_number, font_size))

    return color_keys, locations
