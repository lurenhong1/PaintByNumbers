import type {
    ColorKey,
    PaintRatios,
    ProcessSettings
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
    onMedianFilterSizeChange: (value: number) => void;
    onMergeAreaChange: (value: number) => void;
    onOpenCrop: () => void;
};

function ImageDisplayWindow ({
    croppedImage,
    referenceImage,
    templateImage,
    colorKeys,
    isProcessing,
    settings,
    onColorCountChange,
    onMedianFilterSizeChange,
    onMergeAreaChange,
    onOpenCrop
}: ImageDisplayWindowProps) {
    const minColorCount = 2;
    const maxColorCount = 50;
    const minFilterSize = 3;
    const maxFilterSize = 11;
    const minMergeArea = 100;
    const maxMergeArea = 900;

    const { colorCount, medianFilterSize, mergeArea } = settings;

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

    return (
        <div className="imageDisplayWindow">
            <div ref={leftDisplayRef} className="leftImageDisplay">
                {croppedImage && (
                    <div>
                        <img
                            src={croppedImage}
                            alt="Input image preview"
                            className="image"
                        />
                        <button
                            type='button'
                            className="btn"
                            onClick={onOpenCrop}
                        >
                            Crop Image
                        </button>
                        <div className="sliderControl">
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

                            <label>Filter Size: {medianFilterSize}</label>
                            <div className="slider">
                                <span>{minFilterSize}</span>
                                <input
                                    type="range"
                                    min={minFilterSize}
                                    max={maxFilterSize}
                                    step={2}
                                    value={medianFilterSize}
                                    disabled={isProcessing}
                                    title="Controls image smoothness."
                                    onChange={(e) => onMedianFilterSizeChange(e.currentTarget.valueAsNumber)}
                                />
                                <span>{maxFilterSize}</span>
                            </div>

                            <label>Merge Area: {mergeArea}</label>
                            <div className="slider">
                                <span>{minMergeArea}</span>
                                <input
                                    type="range"
                                    min={minMergeArea}
                                    max={maxMergeArea}
                                    step={100}
                                    value={mergeArea}
                                    disabled={isProcessing}
                                    title="Controls image detail."
                                    onChange={(e) => onMergeAreaChange(e.currentTarget.valueAsNumber)}
                                />
                                <span>{maxMergeArea}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div ref={rightDisplayRef} className="rightImageDisplay">
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

                {colorKeys &&
                    <div className="colorSets">
                        {colorKeys.map(([number, [red, green, blue], mix]) =>(
                            <div className="colorInfo" key={number}>
                                <span className="colorNumber">{number}</span>
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
                                    className="colorFormation"
                                    title={mix
                                        ? `Predicted rgb(${mix.predictedRgb.join(", ")}); average RGB error ${mix.rgbError}`
                                        : undefined
                                    }
                                >
                                    {mix ? formatPaintMix(mix.ratios)
                                        : "Generate a recipe to see the estimated mix"
                                    }
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
                        ))
                        }
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
