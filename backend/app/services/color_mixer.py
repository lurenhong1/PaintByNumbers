import cv2
import mixbox
import numpy as np
from scipy.optimize import minimize


PIGMENT_NAMES = ("red", "yellow", "blue", "black", "white")

# Mixbox-recommended pigment-like RGB values.
BASE_RGB = np.array(
    [
        [255, 39, 2],     # Cadmium red
        [252, 211, 0],    # Hansa yellow
        [0, 33, 133],     # Cobalt blue
        [0, 0, 0],        # Black
        [255, 255, 255],  # White
    ],
    dtype=np.float64,
) / 255.0

BASE_LATENTS = np.array(
    [
        mixbox.float_rgb_to_latent(tuple(rgb))
        for rgb in BASE_RGB
    ],
    dtype=np.float64,
)

def mix_rgb(weights: np.ndarray) -> np.ndarray:
    mixed_latent = weights @ BASE_LATENTS

    return np.array(
        mixbox.latent_to_float_rgb(mixed_latent),
        dtype=np.float64,
    )

def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    pixel = np.asarray(rgb, dtype=np.float32).reshape(1, 1, 3)
    return cv2.cvtColor(pixel, cv2.COLOR_RGB2LAB)[0, 0]

def estimate_paint_mix(target_rgb: tuple[int, int, int]) -> dict[str, object]:
    if (len(target_rgb) != 3 or any(channel < 0 or channel > 255 for channel in target_rgb)):
        raise ValueError("rgb channels must be between 0 and 255")

    target = np.array(target_rgb, dtype=np.float64) / 255.0
    target_lab = rgb_to_lab(target)

    def loss(weights: np.ndarray) -> float:
        predicted_lab = rgb_to_lab(mix_rgb(weights))
        difference = predicted_lab - target_lab

        # Squared Delta-E 76 distance.
        return float(difference @ difference)

    constraint = {
        "type": "eq",
        "fun": lambda weights: weights.sum() - 1.0,
    }

    rng = np.random.default_rng(42)

    starting_points = [
        np.full(5, 0.2),
        *np.eye(5),
        *rng.dirichlet(np.ones(5), size=20),
    ]

    results = []

    for x0 in starting_points:
        candidate = minimize(
            loss,
            x0=x0,
            method="SLSQP",
            bounds=[(0.0, 1.0)] * 5,
            constraints=constraint,
            options={
                "maxiter": 500,
                "ftol": 1e-8,
                "eps": 1e-3,
            },
        )

        if candidate.success and np.isfinite(candidate.fun):
            results.append(candidate)

    if not results:
        raise ValueError("Could not find a valid paint mixture")

    result = min(results, key=lambda candidate: candidate.fun)

    weights = np.clip(result.x, 0.0, 1.0)
    weights /= weights.sum()

    predicted = mix_rgb(weights)
    predicted_rgb = tuple(
        np.round(predicted * 255).astype(int).tolist()
    )

    return {
        "ratios": {
            name: round(float(weight * 100), 1)
            for name, weight in zip(PIGMENT_NAMES, weights)
        },
        "predictedRgb": predicted_rgb,
        "rgbError": round(float(np.sqrt(loss(weights))), 2),
    }
