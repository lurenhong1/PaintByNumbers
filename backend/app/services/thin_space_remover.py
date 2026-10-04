from dataclasses import dataclass

from PIL import Image
from typing import cast
import numpy as np
import cv2

MAX_VH_ITERATIONS = 4
MAX_C_ITERATIONS = 4
TOLERANCE = 0.3
MIN_COVERAGE_IMPROVEMENT = 0.10

@dataclass(slots=True)
class Run:
    """
    A consecutive sequence of pixels sharing one palette index.
    The run covers the half-open interval [start, end) in a row or column.
    """
    color: int
    start: int
    end: int

    @property
    def length(self) -> int:
        return self.end - self.start


def collect_runs(colors: list[int]) -> list[Run]:
    """
    Group consecutive equal palettes indices into runs.
    :param colors: The palette indices of the row/column
    :return: The grouped runs
    """
    if not colors:
        return []

    runs: list[Run] = []
    start = 0
    current_color = colors[0]

    for position in range(1, len(colors)):
        color = colors[position]

        if color != current_color:
            runs.append(Run(color=current_color, start=start, end=position))

            start = position
            current_color = color

    runs.append(Run(color=current_color, start=start, end=len(colors)))

    return runs


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


def choose_target(runs: list[Run], current_index: int, min_length: int, palette_colors: list[tuple[int, int, int]]) -> int | None:
    """
    Select a neighboring run using the following priorities:
    1. Candidates that reach min_length.
    2. Smaller RGB distance.
    3. Greater merged length.
    4. Left/top on a tie.
    :param runs: The processing horizontal/vertical runs
    :param current_index: The index of the short run being replaced
    :param min_length: The minimum number of pixels required
    :param palette_colors: The palette index to RGB mapping
    :return: The index of the selected target if any else None
    """
    current = runs[current_index]

    # (candidate index, merged length, color distance, direction priority)
    candidates: list[tuple[int, int, int, int]] = []

    # Include the left run as candidate if exist
    if current_index > 0:
        left_index = current_index - 1
        left = runs[left_index]

        candidates.append(
            (
                left_index,
                current.length + left.length,
                color_distance_squared(current.color, left.color, palette_colors),
                0
            )
        )

    # Include the right run as candidate if exist
    if current_index + 1 < len(runs):
        right_index = current_index + 1
        right = runs[right_index]

        candidates.append(
            (
                right_index,
                current.length + right.length,
                color_distance_squared(current.color, right.color, palette_colors),
                1
            )
        )

    if not candidates:
        return None

    # Prioritize the candidate that reach the required length
    qualified = [candidate for candidate in candidates if candidate[1] >= min_length]
    available = qualified if qualified else candidates

    # Choose the final candidate following the priority of smaller color
    # difference, larger merged length, top/left (as tiebreaker)
    target = min(
        available,
        key=lambda candidate: (candidate[2], -candidate[1], candidate[3])
    )

    return target[0]


def merge_run(runs: list[Run], current_index: int, target_index: int) -> int:
    """
    Merge the current run with adjacent run with the target color.
    :param runs: The processing horizontal/vertical runs
    :param current_index: The index of the short run being replaced
    :param target_index: The index of the selected adjacent run
    :return: The updated index of the merged run
    """
    target_color = runs[target_index].color
    runs[current_index].color = target_color

    # Merge the left run if exist and have same palette index
    if current_index > 0 and runs[current_index - 1].color == target_color:
        runs[current_index - 1].end = runs[current_index].end
        del runs[current_index]
        current_index -= 1

    # Merge the right run if exist and have same palette index
    if current_index + 1 < len(runs) and runs[current_index + 1].color == target_color:
        runs[current_index].end = runs[current_index + 1].end
        del runs[current_index + 1]

    return current_index


def process_line(colors: list[int], min_length: int, palette_colors: list[tuple[int, int, int]]) -> tuple[list[Run], bool]:
    """
    Repeatedly merge runs whose lengths are less than min_length.
    A single remaining run may still be shorter than the threshold if the
    entire line is shorter.
    :param colors: The color palette index of the row/column
    :param min_length: The minimum number of pixels required
    :param palette_colors: The palette index to RGB mapping
    :return: The processed horizontal/vertical runs and whether merge happened
    """
    runs = collect_runs(colors)
    changed = False
    index = 0

    while index < len(runs):
        current = runs[index]

        if current.length >= min_length:
            index += 1
            continue

        target_index = choose_target(runs, index, min_length, palette_colors)

        if target_index is None:
            index += 1
            continue

        index = merge_run(runs, index, target_index)

        changed = True

        index = max(0, index - 1)

    return runs, changed


def remove_short_runs(image: Image.Image, min_length: int, max_iter: int = MAX_VH_ITERATIONS) -> Image.Image:
    """
    Merge horizontal and vertical runs shorter than min_length.
    The input image is not modified. Processing stops when no changes or after
    a fixed maximum number of passes. Runs may not satisfy the threshold if it
    reaches the maximum number of iterations.
    :param image: The image to process that must have 'P' mode with a palette
    :param min_length: The minimum number of pixels required
    :raises ValueError: If image is not in ``P`` mode.
    :raises ValueError: If image does not contain a palette.
    :raises ValueError: If min_length is less than one.
    :return: A new 'P' mode image that preserves the palette
    """
    if image.mode != "P":
        raise ValueError("image must be a palette image")

    if min_length < 1:
        raise ValueError("min_length must be at least 1")

    palette = image.getpalette()

    if palette is None:
        raise ValueError("image does not contain a color palette")

    palette_colors = [(palette[index], palette[index + 1], palette[index + 2])
                      for index in range(0, len(palette), 3)]

    result = image.copy()
    pixels = result.load()
    width, height = result.size

    for _ in range(max_iter):
        changed = False

        # Row scan
        for y in range(height):
            colors = [cast(int, pixels[x, y]) for x in range(width)]

            runs, line_changed = process_line(colors, min_length, palette_colors)

            if line_changed:
                changed = True

                for run in runs:
                    for x in range(run.start, run.end):
                        pixels[x, y] = run.color

        # Column scan
        for x in range(width):
            colors = [cast(int, pixels[x, y]) for y in range(height)]

            runs, line_changed = process_line(colors, min_length, palette_colors)

            if line_changed:
                changed = True

                for run in runs:
                    for y in range(run.start, run.end):
                        pixels[x, y] = run.color

        if not changed:
            break

    return result

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
    labels = np.array(image, dtype=np.uint8)

    result = labels.copy()
    uncovered_mask: np.ndarray | None = None

    previous_changed = None
    previous_remaining = None
    fallback_requested = False
    fallback_used = False
    for i in range(max_iter):
        if not fallback_requested:
            result, changed, remaining, uncovered_mask = circular_merge_pass(
                result,
                kernel,
                palette_colors,
                uncovered=uncovered_mask,
            )
            if remaining == 0:
                break

            if changed == 0:
                if fallback_used:
                    break

                fallback_requested = True
                continue
            if previous_changed is not None and previous_changed > 0:
                activity_ratio = changed / previous_changed

                if activity_ratio <= TOLERANCE:
                    break
            if previous_remaining is not None and previous_remaining > 0:
                coverage_improvement = (previous_remaining - remaining) / previous_remaining

                if coverage_improvement < MIN_COVERAGE_IMPROVEMENT:
                    if fallback_used:
                        break

                    fallback_requested = True
                    continue

            previous_changed = changed
            previous_remaining = remaining
        else:
            editable_mask = uncovered_mask

            fallback_image = Image.fromarray(result, mode="P")
            fallback_image.putpalette(palette)

            fallback_image = remove_short_runs(fallback_image, min_length, max_iter=1)

            fallback_labels = np.array(fallback_image, dtype=np.uint8)

            result[editable_mask] = fallback_labels[editable_mask]
            uncovered_mask = find_all_unpaintable_pixels(result, kernel)
            remaining = int(np.count_nonzero(uncovered_mask))

            fallback_used = True
            fallback_requested = False
            previous_changed = None
            previous_remaining = None

            if remaining == 0:
                break

    result_image = Image.fromarray(result, mode="P")
    result_image.putpalette(palette)
    return result_image




