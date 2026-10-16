from dataclasses import dataclass

from PIL import Image
from typing import cast
import numpy as np
import cv2

# MAX_VH_ITERATIONS = 4
MAX_C_ITERATIONS = 10
TOLERANCE = 0.3
MIN_COVERAGE_IMPROVEMENT = 0.10

def color_distance_squared(color_a: int, color_b: int, palette_colors: list[tuple[int, int, int]]) -> int:
    """
    Calculate the distance between two colors by squared Euclidean distance.
    :param color_a: Index of the first color
    :param color_b: Index of the second color
    :param palette_colors: The palette index to RGB mapping
    :return: The squared Euclidean distance between the two colors
    """
    rgb_a = palette_colors[color_a]
    rgb_b = palette_colors[color_b]

    return (rgb_a[0] - rgb_b[0]) ** 2 + (rgb_a[1] - rgb_b[1]) ** 2 + (rgb_a[2] - rgb_b[2]) ** 2

def create_brush_kernel(brush_diameter_px: int) -> np.ndarray:
    if brush_diameter_px < 1:
        raise ValueError("brush_diameter_px must be at least 1")

    radius = brush_diameter_px / 2.0
    extent = int(np.ceil(radius))

    y, x = np.ogrid[
        -extent:extent + 1,
        -extent:extent + 1,
    ]

    return (x * x + y * y <= radius * radius).astype(np.uint8)

def find_valid_brush_centers(region_mask: np.ndarray,kernel: np.ndarray) -> np.ndarray:
    mask = (region_mask != 0).astype(np.uint8)

    centers = cv2.erode(
        mask,
        kernel,
        iterations=1,
        borderType=cv2.BORDER_CONSTANT,
        borderValue=0,
    )

    return centers.astype(bool)

def create_paintable_mask(region_mask: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    centers = find_valid_brush_centers(region_mask, kernel)

    covered = cv2.dilate(
        centers.astype(np.uint8),
        kernel,
        iterations=1,
        borderType=cv2.BORDER_CONSTANT,
        borderValue=0,
    )

    return covered.astype(bool) & (region_mask != 0)

def find_unpaintable_pixels(region_mask: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    original = region_mask != 0
    paintable = create_paintable_mask(original, kernel)

    return original & ~paintable

def find_all_unpaintable_pixels(labels: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    uncovered = np.zeros(labels.shape, dtype=bool)

    for color_label in np.unique(labels):
        region_mask = labels == color_label

        uncovered |= find_unpaintable_pixels(
            region_mask,
            kernel,
        )

    return uncovered

def find_unpaintable_patches(labels: np.ndarray, uncovered: np.ndarray, color_label: int) -> tuple[int, np.ndarray, np.ndarray]:
    patch_mask = uncovered & (labels == color_label)

    count, patch_ids, patch_stats, _ = (
        cv2.connectedComponentsWithStats(
            patch_mask.astype(np.uint8),
            connectivity=4,
        )
    )

    return count, patch_ids, patch_stats

def build_region_data(
        labels: np.ndarray,
        uncovered: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    region_map = np.zeros(labels.shape, dtype=np.int32)
    region_colors = [0]  # Reserve region ID 0.
    next_id = 1

    for color_label in np.unique(labels):
        color_mask = labels == color_label

        count, local_ids = cv2.connectedComponents(
            color_mask.astype(np.uint8),
            connectivity=4,
        )

        # Give each component an ID unique across all colors.
        region_map[color_mask] = (
                local_ids[color_mask] + next_id - 1
        )

        region_colors.extend(
            [int(color_label)] * (count - 1)
        )
        next_id += count - 1

    has_paintable = np.zeros(next_id, dtype=bool)

    paintable_region_ids = np.unique(region_map[~uncovered])
    has_paintable[paintable_region_ids] = True
    has_paintable[0] = False

    return (
        region_map,
        np.asarray(region_colors, dtype=np.uint8),
        has_paintable,
    )

def merge_unpaintable_patch(
        labels: np.ndarray,
        result: np.ndarray,
        patch_mask: np.ndarray,
        color_label: int,
        palette_colors: list[tuple[int, int, int]],
        region_map: np.ndarray,
        region_colors: np.ndarray,
        has_paintable: np.ndarray,
) -> int:
    # Count shared edges between each pixel and the patch.
    contacts = np.zeros(labels.shape, dtype=np.uint8)
    contacts[1:, :] += patch_mask[:-1, :]
    contacts[:-1, :] += patch_mask[1:, :]
    contacts[:, 1:] += patch_mask[:, :-1]
    contacts[:, :-1] += patch_mask[:, 1:]

    boundary = (
            (contacts > 0)
            & ~patch_mask
            & (labels != color_label)
    )

    touching_ids, inverse = np.unique(
        region_map[boundary],
        return_inverse=True,
    )

    edge_counts = np.bincount(
        inverse,
        weights=contacts[boundary],
    )

    candidates = []

    for index, region_id in enumerate(touching_ids):
        target_color = int(region_colors[region_id])

        distance = color_distance_squared(
            color_label,
            target_color,
            palette_colors,
        )

        candidates.append((
            not bool(has_paintable[region_id]),
            distance,
            -int(edge_counts[index]),
            target_color,
        ))

    if not candidates:
        return 0

    target_color = min(candidates)[3]

    changed = int(
        np.count_nonzero(result[patch_mask] != target_color)
    )
    result[patch_mask] = target_color

    return changed

def circular_merge_pass(
        labels: np.ndarray,
        kernel: np.ndarray,
        palette_colors: list[tuple[int, int, int]],
        uncovered: np.ndarray | None = None,
) -> tuple[np.ndarray, int, int, np.ndarray]:
    if uncovered is None:
        uncovered = find_all_unpaintable_pixels(labels, kernel)
    region_map, region_colors, has_paintable = build_region_data(
        labels, uncovered
    )

    result = labels.copy()
    changed = 0

    for label in np.unique(labels[uncovered]):
        color_label = int(label)

        count, patch_ids, patch_stats = find_unpaintable_patches(labels, uncovered, color_label)

        for patch_id in range(1, count):
            left, top, width, height = map(int, patch_stats[patch_id, :4])

            y0 = max(0, top - 1)
            y1 = min(labels.shape[0], top + height + 1)
            x0 = max(0, left - 1)
            x1 = min(labels.shape[1], left + width + 1)

            crop = np.s_[y0:y1, x0:x1]
            patch_mask = patch_ids[crop] == patch_id

            changed += merge_unpaintable_patch(
                labels[crop],
                result[crop],
                patch_mask,
                color_label,
                palette_colors,
                region_map[crop],
                region_colors,
                has_paintable,
            )

    remaining_mask = find_all_unpaintable_pixels(result, kernel)
    remaining = int(np.count_nonzero(remaining_mask))

    return result, changed, remaining, remaining_mask


def perform_merge_operation(image: Image.Image, min_length: int, max_iter: int = MAX_C_ITERATIONS):
    if image.mode != "P":
        raise ValueError("image must be a palette image")

    if min_length < 1:
        raise ValueError("min_length must be at least 1")

    palette = image.getpalette()

    if palette is None:
        raise ValueError("image does not contain a color palette")

    palette_colors = [(palette[index], palette[index + 1], palette[index + 2])
                      for index in range(0, len(palette), 3)]

    kernel = create_brush_kernel(min_length)
    result = np.array(image, dtype=np.uint8)
    uncovered_mask: np.ndarray | None = None

    previous_changed = None
    previous_remaining = None
    for _ in range(max_iter):
        result, changed, remaining, uncovered_mask = circular_merge_pass(
            result,
            kernel,
            palette_colors,
            uncovered=uncovered_mask,
        )
        if remaining == 0 or changed == 0:
            break

        if previous_changed is not None and previous_changed > 0:
            activity_ratio = changed / previous_changed

            if activity_ratio <= TOLERANCE:
                break

        if previous_remaining is not None and previous_remaining > 0:
            coverage_improvement = (previous_remaining - remaining) / previous_remaining

            if coverage_improvement < MIN_COVERAGE_IMPROVEMENT:
                break

        previous_changed = changed
        previous_remaining = remaining


    result_image = Image.fromarray(result, mode="P")
    result_image.putpalette(palette)
    return result_image




