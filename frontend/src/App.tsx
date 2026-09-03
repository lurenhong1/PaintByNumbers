import { useRef, useState, type ChangeEvent } from 'react'
import './App.css'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputImage, setInputImage] = useState<string|null>(null);
  const [outputImage, setOutputImage] = useState<string|null>(null);
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
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const result = await response.blob();
      console.log("Response: ", result);
      setOutputImage(URL.createObjectURL(result))
    } catch (error) {
      console.error("Failed to upload image: ", error);
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
        {outputImage && (
            <img
                src={outputImage}
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
