"""Tests for RYBKW paint recipe estimation."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.color_mixer import estimate_paint_mix


client = TestClient(app)


def test_estimate_paint_mix_returns_normalized_recipe() -> None:
    result = estimate_paint_mix((92, 71, 120))

    assert result["ratios"].keys() == {
        "red",
        "yellow",
        "blue",
        "black",
        "white",
    }
    assert sum(result["ratios"].values()) == pytest.approx(100.0)
    assert len(result["predictedRgb"]) == 3
    assert all(0 <= channel <= 255 for channel in result["predictedRgb"])
    assert result["rgbError"] >= 0


@pytest.mark.parametrize("rgb", [(-1, 0, 0), (0, 256, 0)])
def test_estimate_paint_mix_rejects_invalid_rgb(rgb: tuple[int, int, int]) -> None:
    with pytest.raises(ValueError, match="between 0 and 255"):
        estimate_paint_mix(rgb)


def test_recipe_endpoint_enriches_color_keys() -> None:
    response = client.post(
        "/api/images/recipes",
        json={"colorKeys": [[7, [92, 71, 120]]]},
    )

    assert response.status_code == 200
    number, rgb, recipe = response.json()["colorKeys"][0]
    assert number == 7
    assert rgb == [92, 71, 120]
    assert sum(recipe["ratios"].values()) == pytest.approx(100.0)
