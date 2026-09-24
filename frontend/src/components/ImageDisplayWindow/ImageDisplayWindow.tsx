import { useState, type RefObject } from "react";
import type {
    ColorKey,
    PaintRatios,
    ProcessSettings,
    Dimensions
} from "../../types/images.ts";
import useScrollHint from "../../hooks/useScrollHint.ts";
import "./ImageDisplayWindow.css";

type ImageDisplayWindowProps = {
    croppedImage: string | null;
    referenceImage: string | null;
    templateImage: string | null;
    colorKeys: ColorKey[];
    isProcessing: boolean;
    settings: ProcessSettings;
    onColorCountChange: (value: number) => void;
    onFilterLevelChange: (value: number) => void;
    onMergeLevelChange: (value: number) => void;
    onOutputDimensionChange: (dimension: Dimensions) => void;
    onOpenCrop: () => void;
    colorSetsRef: RefObject<HTMLDivElement | null>;
};

function ImageDisplayWindow({
    croppedImage,
    referenceImage,
    templateImage,
    colorKeys,
    isProcessing,
    settings,
    onColorCountChange,
    onFilterLevelChange,
    onMergeLevelChange,
    onOutputDimensionChange,
    onOpenCrop,
    colorSetsRef
}: ImageDisplayWindowProps) {
    const minColorCount = 2;
    const maxColorCount = 50;
    const minFilterLevel = 1;
    const maxFilterLevel = 5;
    const minMergeLevel = 1;
    const maxMergeLevel = 10;

    const { colorCount, filterLevel, mergeLevel, outputDimension } = settings;
    const [currentRatio, setCurrentRatio] = useState<number>(0);
    const [widthText, setWidthText] = useState(
        String(outputDimension.width),
    );
    const [heightText, setHeightText] = useState(
        String(outputDimension.height),
    );

    const hasColorKeys = colorKeys.length > 0;
    const hasAnyMix = colorKeys.some(([, , mix]) => Boolean(mix));

    const {
        panelRef: leftDisplayRef,
        showHint: showLeftHint,
    } = useScrollHint();

    const {
        panelRef: rightDisplayRef,
        showHint: showRightHint,
    } = useScrollHint();

    function formatPaintMix(ratios: PaintRatios): string {
        return Object.entries(ratios)
            .filter(([, percentage]) => percentage > 0)
            .map(([paint, percentage]) => (
                `${paint[0].toUpperCase()}${paint.slice(1)} ${percentage}%`
            ))
            .join(" · ");
    }

    const MIN_OUTPUT_PIXELS = 1000;
    const MAX_OUTPUT_PIXELS = 4096;

    function fitWithinBounds(width: number, height: number): Dimensions {
        if (width <= 0 || height <= 0) {
            return outputDimension;
        }

        const minimumScale = Math.max(
            MIN_OUTPUT_PIXELS / width,
            MIN_OUTPUT_PIXELS / height,
        );

        const maximumScale = Math.min(
            MAX_OUTPUT_PIXELS / width,
            MAX_OUTPUT_PIXELS / height,
        );

        const scale = Math.min(
            maximumScale,
            Math.max(minimumScale, 1),
        );

        return {
            width: Math.round(width * scale),
            height: Math.round(height * scale),
        };
    }

    function commitWidth() {
        const width = Number(widthText);

        if (widthText.trim() === "" || !Number.isFinite(width) || currentRatio <= 0) {
            setWidthText(String(outputDimension.width));
            return;
        }

        const dimensions = fitWithinBounds(
            width,
            width / currentRatio,
        );

        setWidthText(String(dimensions.width));
        setHeightText(String(dimensions.height));
        onOutputDimensionChange(dimensions);
    }

    function commitHeight() {
        const height = Number(heightText);

        if (heightText.trim() === "" || !Number.isFinite(height) || currentRatio <= 0) {
            setHeightText(String(outputDimension.height));
            return;
        }

        const dimensions = fitWithinBounds(
            height * currentRatio,
            height,
        );

        setWidthText(String(dimensions.width));
        setHeightText(String(dimensions.height));
        onOutputDimensionChange(dimensions);
    }

    return (
        <div className="image-display-window">
            <div ref={leftDisplayRef} className="left-image-display">
                {!croppedImage && (
                    <div className="empty-state">
                        <strong>Start with a favorite image</strong>
                        <span>Upload a photo to configure your paint-by-numbers design.</span>
                    </div>
                )}
                {croppedImage && (
                    <div style={{
                        display: "flex",
                        flexDirection: 'column',
                        gap: '10px',
                        alignItems: 'center'
                    }}>
                        <img
                            src={croppedImage}
                            alt="Input image preview"
                            className="image"
                            onLoad={(event) => {
                                const {
                                    naturalWidth,
                                    naturalHeight,
                                } = event.currentTarget;

                                const ratio = naturalWidth / naturalHeight;
                                setCurrentRatio(ratio);

                                const dimensions = fitWithinBounds(
                                    naturalWidth,
                                    naturalHeight,
                                );

                                setWidthText(String(dimensions.width));
                                setHeightText(String(dimensions.height));
                                onOutputDimensionChange(dimensions);
                            }}
                        />
                        <button
                            type='button'
                            className="btn"
                            onClick={onOpenCrop}
                        >
                            Crop Image
                        </button>
                        {currentRatio &&
                            <span>Current Ratio: {currentRatio.toFixed(2)}</span>
                        }
                        <div className="dimension-control">
                            <span>Output Dimension: </span>
                            <input
                                type="number"
                                value={widthText}
                                min={MIN_OUTPUT_PIXELS}
                                max={MAX_OUTPUT_PIXELS}
                                step={1}
                                onChange={(event) => setWidthText(event.currentTarget.value)}
                                onBlur={commitWidth}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        event.currentTarget.blur();
                                    }
                                }}
                            />
                            :
                            <input
                                type="number"
                                value={heightText}
                                min={MIN_OUTPUT_PIXELS}
                                max={MAX_OUTPUT_PIXELS}
                                step={1}
                                onChange={(event) => setHeightText(event.currentTarget.value)}
                                onBlur={commitHeight}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        event.currentTarget.blur();
                                    }
                                }}
                            />
                        </div>
                        <div className="slider-control">
                            <label>Color Count: {colorCount}</label>
                            <div className="slider">
                                <span>{minColorCount}</span>
                                <input
                                    type="range"
                                    min={minColorCount}
                                    max={maxColorCount}
                                    step={1}
                                    value={colorCount}
                                    disabled={isProcessing}
                                    title="Controls amount of color present."
                                    onChange={(e) => onColorCountChange(e.currentTarget.valueAsNumber)}
                                />
                                <span>{maxColorCount}</span>
                            </div>

                            <label>Smooth Level: {filterLevel}</label>
                            <div className="slider">
                                <span>{minFilterLevel}</span>
                                <input
                                    type="range"
                                    min={minFilterLevel}
                                    max={maxFilterLevel}
                                    step={1}
                                    value={filterLevel}
                                    disabled={isProcessing}
                                    title="Controls image smoothness."
                                    onChange={(e) => onFilterLevelChange(e.currentTarget.valueAsNumber)}
                                />
                                <span>{maxFilterLevel}</span>
                            </div>

                            <label>Merge Level: {mergeLevel}</label>
                            <div className="slider">
                                <span>{minMergeLevel}</span>
                                <input
                                    type="range"
                                    min={minMergeLevel}
                                    max={maxMergeLevel}
                                    step={1}
                                    value={mergeLevel}
                                    disabled={isProcessing}
                                    title="Controls image detail."
                                    onChange={(e) => onMergeLevelChange(e.currentTarget.valueAsNumber)}
                                />
                                <span>{maxMergeLevel}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div ref={rightDisplayRef} className="right-image-display">
                {!referenceImage && !templateImage && (
                    <div className="empty-state">
                        <strong>Your artwork will appear here</strong>
                        <span>Adjust the settings, then select Generate.</span>
                    </div>
                )}
                {referenceImage && (
                    <img
                        src={referenceImage}
                        alt="Input image preview"
                        className="image"
                    />
                )}

                {templateImage && (
                    <img
                        src={templateImage}
                        alt="Input image preview"
                        className="image"
                    />
                )}

                {hasColorKeys &&
                    <div>
                        {!hasAnyMix && (
                            <span>Generate color recipes to see the estimated mix for each color.</span>
                        )}
                        <div ref={colorSetsRef} className="color-sets-export">
                            <div className="color-sets">
                                <div className="color-info color-header">
                                    <span>#</span>
                                    <span>Color</span>
                                    {hasAnyMix
                                        ? (
                                            <>
                                                <span>Estimated Mix</span>
                                                <span>Result</span>
                                            </>
                                        )
                                        : (
                                            <>
                                                <span/>
                                                <span/>
                                            </>
                                        )
                                    }
                                </div>

                                {colorKeys.map(([number, [red, green, blue], mix]) =>(
                                    <div className="color-info" key={number}>
                                        <span className="color-number">{number}</span>
                                        <span
                                            title="Palette color."
                                            style={{
                                                display: "inline-block",
                                                width: "24px",
                                                height: "24px",
                                                backgroundColor: `rgb(${red}, ${green}, ${blue})`,
                                            }}
                                        />
                                        <span
                                            className="color-formation"
                                            title={mix
                                                ? `Predicted rgb(${mix.predictedRgb.join(", ")}); average RGB error ${mix.rgbError}`
                                                : undefined
                                            }
                                        >
                                    {mix ? formatPaintMix(mix.ratios) : null}
                                </span>
                                        {mix
                                            ? <span
                                                title="Estimated paint mix."
                                                style={{
                                                    display: "inline-block",
                                                    width: "24px",
                                                    height: "24px",
                                                    backgroundColor: `rgb(${mix.predictedRgb[0]}, ${mix.predictedRgb[1]}, ${mix.predictedRgb[2]})`,
                                                }}
                                            />
                                            : <span
                                                aria-hidden="true"
                                                style={{
                                                    display: "inline-block",
                                                    width: "24px",
                                                    height: "24px",
                                                    visibility: "hidden",
                                                }}
                                            />
                                        }
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                }
            </div>
            <div
                className={`scroll-hint scroll-hint-left ${
                    showLeftHint ? "" : "hidden"
                }`}
                aria-hidden="true"
            >
                ⌄
            </div>

            <div
                className={`scroll-hint scroll-hint-right ${
                    showRightHint ? "" : "hidden"
                }`}
                aria-hidden="true"
            >
                ⌄
            </div>
        </div>
    );
}

export default ImageDisplayWindow;
