import { useRef, useState, type ChangeEvent } from 'react'
import './App.css'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputImage, setInputImage] = useState<string|null>(null);
  const [numberedImage, setNumberedImage] = useState<string|null>(null);
  const [expectedImage, setExpectedImage] = useState<string|null>(null);
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

  async function handleUpdate(): Promise<void> {
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

      const result = await response.json();
      console.log("Response: ", result);
      setProcessing(false);
      setNumberedImage(`data:image/png;base64,${result.numberedImage}`);
      setExpectedImage(`data:image/png;base64,${result.expectedImage}`);
    } catch (error) {
      console.error("Failed to upload image: ", error);
      setProcessing(false);
    }
  }

  return (
    <>
      <section id="main">
        <button id="addImageBtn" onClick={() => fileInputRef.current?.click()}>
          Add Image
        </button>
        {inputImage && (
            <img
                src={inputImage}
                alt="Input image preview"
                className="image-preview"
            />
        )}
        <button id="uploadImageBtn" onClick={handleUpdate}>
          Upload
        </button>
        {emptyImage && (<p>Please select an image before upload.</p>)}
        {processing && (<p>Image processing, please wait.</p>)}
        {numberedImage && (
            <img
                src={numberedImage}
                alt="Input image preview"
                className="image-preview"
            />
        )}
        {expectedImage && (
            <img
                src={expectedImage}
                alt="Input image preview"
                className="image-preview"
            />
        )}
      </section>
      <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleImageChange}
          hidden
      />

    </>
  )
}

export default App
