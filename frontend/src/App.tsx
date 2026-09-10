import { useRef, useState, type ChangeEvent } from 'react'
import './App.css'

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
    numberedImage: string;
    expectedImage: string;
    colorKeys: ColorKey[];
  };

  type ColorRecipeResponse = {
    colorKeys: ColorKey[];
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputImage, setInputImage] = useState<string|null>(null);
  const [numberedImage, setNumberedImage] = useState<string|null>(null);
  const [expectedImage, setExpectedImage] = useState<string|null>(null);
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

    // console.log("Selected image:", selectedImage);
    setInputImage(URL.createObjectURL(selectedImage))
  }

  function startProcess(message: string) {
    setProcessing(true);
    setProcessMessage(message);
  }

  function endProcess() {
    setProcessing(false)
    setProcessMessage('')
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

      setNumberedImage(`data:image/png;base64,${result.numberedImage}`);
      setExpectedImage(`data:image/png;base64,${result.expectedImage}`);
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

  return (
    <>
      <section id="main">
        <div id="toolbar">
          <button
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
              className="btn"
              onClick={handleGenerate}
              disabled={!inputImage || processing}
          >
            Generate
          </button>

          <button
              className="btn"
              onClick={handleGetColorRecipe}
              disabled={colorKeys.length === 0 || processing}
          >
            Get Color Recipe
          </button>

          <button className="btn">
            Download Referenced
          </button>

          <button className="btn">
            Download Template
          </button>

          <button className="btn">
            Download Color Sets
          </button>

          <button className="btn">
            Download All
          </button>

        </div>
        <div id="imageDisplayWindow">
          <div id="leftImageDisplay">
            {inputImage && (
                <div>
                  <img
                      src={inputImage}
                      alt="Input image preview"
                      className="image"
                  />
                  <div id="sliderControl">
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
          <div id="rightImageDisplay">
            {expectedImage && (
                <img
                    src={expectedImage}
                    alt="Input image preview"
                    className="image"
                />
            )}

            {numberedImage && (
                <img
                    src={numberedImage}
                    alt="Input image preview"
                    className="image"
                />
            )}

            {colorKeys &&
                <div id="colorSets">
                  {colorKeys.map(([number, [red, green, blue], mix]) =>(
                      <div className="colorInfo" key={number}>
                        <p className="colorNumber">{number}</p>
                        <span style={{
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
                            ? <span style={{
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
        </div>
        {emptyImage && (<p>Please select an image before upload.</p>)}
        {processing && (<p>{processMessage}</p>)}



      </section>

    </>
  )
}

export default App
