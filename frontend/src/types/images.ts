export type RGB = [number, number, number];

export type PaintRatios = {
    red: number;
    yellow: number;
    blue: number;
    black: number;
    white: number;
};

export type PaintMix = {
    ratios: PaintRatios;
    predictedRgb: RGB;
    rgbError: number;
};

export type ColorKey = [number, RGB, PaintMix?, RGB?];

export type ProcessImageResponse = {
    templateImage: string;
    referenceImage: string;
    colorKeys: ColorKey[];
};

export type ColorRecipeResponse = {
    colorKeys: ColorKey[];
};

export type ProcessSettings = {
    colorCount: number;
    medianFilterSize: number;
    mergeArea: number;
};
