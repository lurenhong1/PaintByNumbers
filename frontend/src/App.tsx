import { useRef, useState, type ChangeEvent } from 'react'
import './App.css'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayImage, setDisplayImage] = useState<string|null>(null);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedImage = event.target.files?.[0];

    if (!selectedImage) {
      return;
    }

    // console.log("Selected image:", selectedImage);
    setDisplayImage(URL.createObjectURL(selectedImage))
  }

  return (
    <>
      <section id="main">
        <button id="addImageBtn" onClick={() => fileInputRef.current?.click()}>
          Add Image
        </button>
        {displayImage && (
            <img
                src={displayImage}
                alt="Selected image preview"
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
