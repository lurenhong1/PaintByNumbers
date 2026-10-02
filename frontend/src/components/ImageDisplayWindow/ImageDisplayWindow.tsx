import {useState, type RefObject, useEffect} from "react";
import type {
    ColorKey,
    PaintRatios,
    ProcessSettings,
    Dimensions,
    UnitOfLength,
    PaperName
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
    const [paperName, setPaperName] = useState<PaperName>('Letter')
    const [widthText, setWidthText] = useState("8.5");
    const [heightText, setHeightText] = useState("11");
    const [PPI, setPPI] = useState<string>("300");
    const [paperRatioUnit, setPaperRatioUnit] = useState<UnitOfLength>('in')

    const PAPER_SIZES_INCHES = {
        A5: { width: "5.83", height: "8.27" },
        A4: { width: "8.27", height: "11.69" },
        A3: { width: "11.69", height: "16.54" },
        A2: { width: "16.54", height: "23.39" },

        Letter: { width: "8.5", height: "11" },
        Legal: { width: "8.5", height: "14" },
        Tabloid: { width: "11", height: "17" },
    } as const;

    const PAPER_SIZES_CM = {
        A5: { width: "14.8", height: "21" },
        A4: { width: "21", height: "29.7" },
        A3: { width: "29.7", height: "42" },
        A2: { width: "42", height: "59.4" },

        Letter: { width: "21.59", height: "27.94" },
        Legal: { width: "21.59", height: "35.56" },
        Tabloid: { width: "27.94", height: "43.18" },
    } as const;

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

    useEffect(() => {
        if (
            widthText.trim() === "" ||
            heightText.trim() === "" ||
            PPI.trim() === ""
        ) {
            return;
        }

        const width = Number(widthText);
        const height = Number(heightText);
        const parsedPPI = Number(PPI);

        if (
            !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(parsedPPI) ||
            width <= 0 || height <= 0 || parsedPPI <= 0
        ) {
            return;
        }

        if (paperRatioUnit === "in") {
            onOutputDimensionChange({
                width: Math.round(width * parsedPPI),
                height: Math.round(height * parsedPPI)
            })
        } else {
            onOutputDimensionChange({
                width: Math.round((width / 2.54) * parsedPPI),
                height: Math.round((height / 2.54) * parsedPPI)
            })
        }
    }, [
        widthText,
        heightText,
        PPI,
        paperRatioUnit,
        onOutputDimensionChange,
    ]);

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
                            <div className="paper-control">
                                Paper:

                                <select
                                    value={paperName}
                                    onChange={(event) => {
                                        const name = event.currentTarget.value as PaperName
                                        setPaperName(name)
                                        if (name !== "Customize") {
                                            if (paperRatioUnit === "in") {
                                                setWidthText(PAPER_SIZES_INCHES[name].width)
                                                setHeightText(PAPER_SIZES_INCHES[name].height)
                                            } else {
                                                setWidthText(PAPER_SIZES_CM[name].width)
                                                setHeightText(PAPER_SIZES_CM[name].height)
                                            }
                                        }
                                    }}
                                >
                                    <option value='Customize'>Customize</option>
                                    <option value='A5'>A5</option>
                                    <option value='A4'>A4</option>
                                    <option value='A3'>A3</option>
                                    <option value='A2'>A2</option>
                                    <option value='Letter'>Letter</option>
                                    <option value='Legal'>Legal</option>
                                    <option value='Tabloid'>Tabloid</option>
                                </select>
                            </div>

                            <div className="paper-size-control">
                                Paper Size:
                                <input
                                    className="paper-size-input"
                                    type="number"
                                    value={widthText}
                                    min={0}
                                    onChange={(event) => {
                                        setWidthText(event.currentTarget.value)
                                        setPaperName("Customize")
                                    }}
                                />
                                :
                                <input
                                    className="paper-size-input"
                                    type="number"
                                    value={heightText}
                                    min={0}
                                    onChange={(event) => {
                                        setHeightText(event.currentTarget.value)
                                        setPaperName("Customize")
                                    }}
                                />
                            </div>

                            <div className="unit-control">
                                Unit:
                                <select
                                    value={paperRatioUnit}
                                    onChange={(event) => {
                                        const unit = event.currentTarget.value as UnitOfLength
                                        setPaperRatioUnit(unit)
                                        if (paperName !== "Customize") {
                                            if (unit === "in") {
                                                setWidthText(PAPER_SIZES_INCHES[paperName].width)
                                                setHeightText(PAPER_SIZES_INCHES[paperName].height)
                                            } else {
                                                setWidthText(PAPER_SIZES_CM[paperName].width)
                                                setHeightText(PAPER_SIZES_CM[paperName].height)
                                            }
                                        }
                                    }}
                                >
                                    <option value='in'>in</option>
                                    <option value='cm'>cm</option>
                                </select>
                            </div>

                            <div className="ppi-control">
                                PPI:
                                <input
                                    type="number"
                                    value={PPI}
                                    min={0}
                                    onChange={(event) => {
                                        setPPI(event.currentTarget.value)
                                    }}
                                />
                            </div>
                            <div className="approximate-pixel-display">
                                Approximate output pixels: {outputDimension.width} x {outputDimension.height}
                            </div>
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
