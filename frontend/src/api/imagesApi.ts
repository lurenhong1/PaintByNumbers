import type {
    ColorKey,
    ColorRecipeResponse,
    ProcessImageResponse,
    ProcessSettings,
} from '../types/images';

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

export async function processImage(
    imageFile: File,
    settings: ProcessSettings,
): Promise<ProcessImageResponse> {
    const formData = new FormData();

    formData.append('image', imageFile);
    formData.append('colorCount', String(settings.colorCount));
    formData.append(
        'medianFilterSize',
        String(settings.medianFilterSize),
    );
    formData.append('mergeArea', String(settings.mergeArea));

    const response = await fetch(
        `${API_BASE_URL}/api/images/process`,
        {
            method: 'POST',
            body: formData
        });

    if (!response.ok) {
        const errorBody = await response.json();

        throw new Error(
            errorBody.detail ??
            `Upload failed with status ${response.status}`
        );
    }

    return response.json();
}

export async function getColorRecipes(colorKeys: ColorKey[]): Promise<ColorRecipeResponse> {
    const response = await fetch(
        `${API_BASE_URL}/api/images/recipes`,
        {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                colorKeys: colorKeys.map(([number, rgb]) => [number, rgb]),
            })
        });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(
            errorBody.detail ??
            `Recipe request failed with status ${response.status}`
        );
    }

    return response.json();
}
