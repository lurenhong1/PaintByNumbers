from dataclasses import dataclass

from PIL import Image
from typing import cast

MAX_ITERATIONS = 10

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


def remove_short_runs(image: Image.Image, min_length: int) -> Image.Image:
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

    for _ in range(MAX_ITERATIONS):
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
