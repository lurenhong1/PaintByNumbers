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
    filterLevel: number;
    mergeLevel: number;
    outputDimension: Dimensions;
};

export type Dimensions = {
    width: number;
    height: number;
};

export type UnitOfLength = 'in' | 'cm';

export type PaperName = 'A5' | 'A4' | 'A3' | 'A2' | 'Letter' | 'Legal' | 'Tabloid' | 'Customize';
