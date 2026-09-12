import { useEffect, useRef, useState, type ChangeEvent, type WheelEvent } from 'react'
import './App.css'
import ImageCropModal from './components/ImageCropModal/ImageCropModal.tsx'

function useScrollHint(bottomTolerance = 4) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    let animationFrame = 0;

    const updateVisibility = () => {
      const distanceFromBottom =
          panel.scrollHeight -
          panel.clientHeight -
          panel.scrollTop;

      setShowHint(distanceFromBottom > bottomTolerance);
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateVisibility);
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);

    const observeSizes = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(panel);

      for (const child of panel.children) {
        resizeObserver.observe(child);
      }

      scheduleUpdate();
    };

    const mutationObserver = new MutationObserver(observeSizes);

    mutationObserver.observe(panel, {
      childList: true,
    });

    panel.addEventListener("scroll", scheduleUpdate, {
      passive: true,
    });

    observeSizes();

    return () => {
      cancelAnimationFrame(animationFrame);
      panel.removeEventListener("scroll", scheduleUpdate);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [bottomTolerance]);

  return {
    panelRef,
    showHint,
  };
}

function App() {
  type RGB = [number, number, number];
  type PaintRatios = {
    red: number;
    yellow: number;
    blue: number;
    black: number;
    white: number;
  };
  type PaintMix = {
    ratios: PaintRatios;
    predictedRgb: RGB;
    rgbError: number;
  };
  type ColorKey = [number, RGB, PaintMix?, RGB?];

  type ProcessImageResponse = {
    templateImage: string;
    referenceImage: string;
    colorKeys: ColorKey[];
  };

  type ColorRecipeResponse = {
    colorKeys: ColorKey[];
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputImage, setInputImage] = useState<string|null>(null);
  const [croppedImage, setCroppedImage] = useState<string|null>(null);
  const [templateImage, setTemplateImage] = useState<string|null>(null);
  const [referenceImage, setReferenceImage] = useState<string|null>(null);
  const [colorKeys, setColorKeys] = useState<ColorKey[]>([]);

  const [processing, setProcessing] = useState<boolean>(false);
  const [processMessage, setProcessMessage] = useState<string>('');
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [emptyImage, setEmptyImage] = useState<boolean>(false);

  const minColorCount = 2;
  const maxColorCount = 50;
  const [colorCount, setColorCount] = useState<number>(20);
  const minFilterSize = 3;
  const maxFilterSize = 11;
  const [medianFilterSize, setMedianFilterSize] = useState<number>(7);
  const minMergeArea = 100;
  const maxMergeArea = 900;
  const [mergeArea, setMergeArea] = useState<number>(500);

  const [aspectRatio, setAspectRatio] = useState<number | undefined>();

  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);

  function formatPaintMix(ratios: PaintRatios): string {
    return Object.entries(ratios)
        .filter(([, percentage]) => percentage > 0)
        .map(([paint, percentage]) => (
            `${paint[0].toUpperCase()}${paint.slice(1)} ${percentage}%`
        ))
        .join(" · ");
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedImage = event.target.files?.[0];

    if (!selectedImage) {
      return;
    }

    setImageFile(selectedImage)

    const image = URL.createObjectURL(selectedImage)

    // console.log("Selected image:", selectedImage);
    setInputImage(image)
    setCroppedImage(image)
  }

  function startProcess(message: string) {
    setProcessing(true);
    setProcessMessage(message);
  }

  function endProcess() {
    setProcessing(false)
    setProcessMessage('')
  }

  function onCancel() {
    setIsCropModalOpen(false);
  }

  function handleCropApply(blob: Blob) {
    const originalName = imageFile?.name.replace(/\.[^.]+$/, '') ?? 'image'

    const croppedFile = new File(
        [blob],
        `${originalName}-cropped.png`,
        { type: blob.type }
    )

    setCroppedImage(URL.createObjectURL(blob))
    setImageFile(croppedFile)
    setIsCropModalOpen(false)
  }

  function handleToolbarWheel(event: WheelEvent<HTMLDivElement>) {
    const toolbar = event.currentTarget;

    if (toolbar.scrollWidth <= toolbar.clientWidth) return;

    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      toolbar.scrollLeft += event.deltaY;
    }
  }

  async function handleGenerate(): Promise<void> {
    if (!imageFile) {
      setEmptyImage(true);
      return;
    }

    setEmptyImage(false);
    startProcess("Image Processing");

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("colorCount", String(colorCount));
    formData.append("medianFilterSize", String(medianFilterSize));
    formData.append("mergeArea", String(mergeArea))

    try {
      const response = await fetch(
          "http://127.0.0.1:8000/api/images/process",
          {
            method: "POST",
            body: formData,
          },
      );

      if (!response.ok) {
        const errorBody = await response.json()
        throw new Error(
            errorBody.detail ?? `Upload failed with status ${response.status}`,
        )
      }

      const result: ProcessImageResponse = await response.json();
      console.log("Response: ", result);

      setTemplateImage(`data:image/png;base64,${result.templateImage}`);
      setReferenceImage(`data:image/png;base64,${result.referenceImage}`);
      setColorKeys(result.colorKeys);
    } catch (error) {
      console.error("Failed to upload image: ", error);
    } finally {
      endProcess();
    }
  }

  async function handleGetColorRecipe(): Promise<void> {
    if (colorKeys.length === 0) {
      return;
    }

    startProcess("Generating Color Recipe");

    try {
      const response = await fetch(
          "http://127.0.0.1:8000/api/images/recipes",
          {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              colorKeys: colorKeys.map(([number, rgb]) => [number, rgb]),
            }),
          },
      );

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(
            errorBody.detail ?? `Recipe request failed with status ${response.status}`,
        );
      }

      const result: ColorRecipeResponse = await response.json();
      setColorKeys(result.colorKeys);
    } catch (error) {
      console.error("Failed to generate color recipes: ", error);
    } finally {
      endProcess();
    }

  }

  const {
    panelRef: leftDisplayRef,
    showHint: showLeftHint,
  } = useScrollHint();

  const {
    panelRef: rightDisplayRef,
    showHint: showRightHint,
  } = useScrollHint();

  return (
    <>
      <section className="main">
        <div className="toolbar" onWheel={handleToolbarWheel}>
          <button
              type='button'
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
          >
            Upload Image
          </button>
          <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              hidden
          />

          <button
              type='button'
              className="btn"
              onClick={handleGenerate}
              disabled={!croppedImage || processing}
          >
            Generate
          </button>

          <button
              type='button'
              className="btn"
              onClick={handleGetColorRecipe}
              disabled={colorKeys.length === 0 || processing}
          >
            Get Color Recipe
          </button>

          <button
              type='button'
              className="btn"
          >
            Download Referenced
          </button>

          <button
              type='button'
              className="btn"
          >
            Download Template
          </button>

          <button
              type='button'
              className="btn"
          >
            Download Color Sets
          </button>

          <button
              type='button'
              className="btn"
          >
            Download All
          </button>
        </div>
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
                      onClick={() => {setIsCropModalOpen(true)}}
                  >
                    Crop Image
                  </button>
                  <div className="sliderControl">
                    <label>Color Count: {colorCount}</label>
                    <div className="slider">
                      <p>{minColorCount}</p>
                      <input
                          type="range"
                          min={minColorCount}
                          max={maxColorCount}
                          step={1}
                          value={colorCount}
                          disabled={processing}
                          title="Controls amount of color present."
                          onChange={(e) => setColorCount(e.currentTarget.valueAsNumber)}
                      />
                      <p>{maxColorCount}</p>
                    </div>

                    <label>Filter Size: {medianFilterSize}</label>
                    <div className="slider">
                      <p>{minFilterSize}</p>
                      <input
                          type="range"
                          min={minFilterSize}
                          max={maxFilterSize}
                          step={2}
                          value={medianFilterSize}
                          disabled={processing}
                          title="Controls image smoothness."
                          onChange={(e) => setMedianFilterSize(e.currentTarget.valueAsNumber)}
                      />
                      <p>{maxFilterSize}</p>
                    </div>

                    <label>Merge Area: {mergeArea}</label>
                    <div className="slider">
                      <p>{minMergeArea}</p>
                      <input
                          type="range"
                          min={minMergeArea}
                          max={maxMergeArea}
                          step={100}
                          value={mergeArea}
                          disabled={processing}
                          title="Controls image detail."
                          onChange={(e) => setMergeArea(e.currentTarget.valueAsNumber)}
                      />
                      <p>{maxMergeArea}</p>
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
                        <p className="colorNumber">{number}</p>
                        <span
                            title="Palette color."
                            style={{
                              display: "inline-block",
                              width: "24px",
                              height: "24px",
                              backgroundColor: `rgb(${red}, ${green}, ${blue})`,
                            }}
                        />
                        <p
                            className="colorFormation"
                            title={mix
                                ? `Predicted rgb(${mix.predictedRgb.join(", ")}); average RGB error ${mix.rgbError}`
                                : undefined
                            }
                        >
                          {mix ? formatPaintMix(mix.ratios)
                              : "Generate a recipe to see the estimated mix"
                          }
                        </p>
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
        {emptyImage && (<p>Please select an image before upload.</p>)}
        {processing && (<p>{processMessage}</p>)}



      </section>
      {isCropModalOpen && inputImage &&
          <ImageCropModal
              imageUrl={inputImage}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              onApply={handleCropApply}
              onCancel={onCancel}
          />
      }
    </>
  )
}

export default App
