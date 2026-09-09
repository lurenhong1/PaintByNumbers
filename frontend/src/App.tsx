import { useRef, useState, type ChangeEvent } from 'react'
import './App.css'

function App() {
  type RGB = [number, number, number];
  type ColorKey = [number, RGB];

  type ProcessImageResponse = {
    numberedImage: string;
    expectedImage: string;
    colorKeys: ColorKey[];
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputImage, setInputImage] = useState<string|null>(null);
  const [numberedImage, setNumberedImage] = useState<string|null>(null);
  const [expectedImage, setExpectedImage] = useState<string|null>(null);
  const [colorKeys, setColorKeys] = useState<ColorKey[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [emptyImage, setEmptyImage] = useState<boolean>(false);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedImage = event.target.files?.[0];

    if (!selectedImage) {
      return;
    }

    setImageFile(selectedImage)

    // console.log("Selected image:", selectedImage);
    setInputImage(URL.createObjectURL(selectedImage))
  }

  async function handleGenerate(): Promise<void> {
    if (!imageFile) {
      setEmptyImage(true);
      return;
    }

    setEmptyImage(false);
    setProcessing(true);

    const formData = new FormData();
    formData.append("image", imageFile);

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
      setProcessing(false);

      setNumberedImage(`data:image/png;base64,${result.numberedImage}`);
      setExpectedImage(`data:image/png;base64,${result.expectedImage}`);
      setColorKeys(result.colorKeys);
    } catch (error) {
      console.error("Failed to upload image: ", error);
      setProcessing(false);
    }
  }

  return (
    <>
      <section id="main">
        <div id="toolbar">
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            Upload Image
          </button>
          <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              hidden
          />

          <button className="btn" onClick={handleGenerate}>
            Generate
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
                <img
                    src={inputImage}
                    alt="Input image preview"
                    className="image"
                />
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
                  {colorKeys.map(([number, [red, green, blue]]) =>(
                      <div className="colorInfo" key={number}>
                        <p className="colorNumber">{number}</p>
                        <span style={{
                          display: "inline-block",
                          width: "24px",
                          height: "24px",
                          backgroundColor: `rgb(${red}, ${green}, ${blue})`,
                        }}
                        />
                        <p className="colorFormation">color can be formed by</p>
                      </div>
                  ))
                  }
                </div>
            }
          </div>
        </div>
        {emptyImage && (<p>Please select an image before upload.</p>)}
        {processing && (<p>Image processing, please wait.</p>)}



      </section>

    </>
  )
}

export default App
