import { useState } from 'react';
import type { ColorKey } from './types/images';
import './App.css';
import ImageCropModal from './components/ImageCropModal/ImageCropModal.tsx';
import { getColorRecipes, processImage } from './api/imagesApi';
import Toolbar from "./components/Toolbar/Toolbar.tsx";
import ImageDisplayWindow from "./components/ImageDisplayWindow/ImageDisplayWindow.tsx";

function App() {
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [inputImage, setInputImage] = useState<string|null>(null);
  const [croppedImage, setCroppedImage] = useState<string|null>(null);
  const [templateImage, setTemplateImage] = useState<string|null>(null);
  const [referenceImage, setReferenceImage] = useState<string|null>(null);
  const [colorKeys, setColorKeys] = useState<ColorKey[]>([]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isEmptyImage, setIsEmptyImage] = useState<boolean>(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);

  const [processMessage, setProcessMessage] = useState<string>('');

  const [colorCount, setColorCount] = useState<number>(20);
  const [medianFilterSize, setMedianFilterSize] = useState<number>(7);
  const [mergeArea, setMergeArea] = useState<number>(500);

  const [aspectRatio, setAspectRatio] = useState<number | undefined>();

  function handleImageSelected(selectedImage: File) {
    setImageFile(selectedImage);

    const image = URL.createObjectURL(selectedImage);

    setInputImage(image);
    setCroppedImage(image);
  }

  async function handleGenerate(): Promise<void> {
    if (!imageFile) {
      setIsEmptyImage(true);
      return;
    }

    setIsEmptyImage(false);
    onProcessStart("Image Processing");

    try {
      const result = await processImage(imageFile, {
        colorCount,
        medianFilterSize,
        mergeArea,
      });

      setTemplateImage(`data:image/png;base64,${result.templateImage}`);
      setReferenceImage(`data:image/png;base64,${result.referenceImage}`);
      setColorKeys(result.colorKeys);
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      onProcessEnd();
    }
  }

  async function handleGetColorRecipe(): Promise<void> {
    if (colorKeys.length === 0) {
      return;
    }

    onProcessStart("Generating Color Recipe");

    try {
      const result = await getColorRecipes(colorKeys);
      setColorKeys(result.colorKeys);
    } catch (error) {
      console.error("Failed to generate color recipes: ", error);
    } finally {
      onProcessEnd();
    }
  }

  function handleCropApply(blob: Blob) {
    const originalName = imageFile?.name.replace(/\.[^.]+$/, '') ?? 'image';

    const croppedFile = new File(
        [blob],
        `${originalName}-cropped.png`,
        { type: blob.type }
    );

    setCroppedImage(URL.createObjectURL(blob));
    setImageFile(croppedFile);
    setIsCropModalOpen(false);
  }

  function onProcessStart(message: string) {
    setIsProcessing(true);
    setProcessMessage(message);
  }

  function onProcessEnd() {
    setIsProcessing(false);
    setProcessMessage('');
  }

  function onCancel() {
    setIsCropModalOpen(false);
  }

  return (
    <>
      <section className="main">
        <Toolbar
            isProcessing={isProcessing}
            canGenerate={croppedImage !== null}
            canGetColorRecipe={colorKeys.length > 0}
            onImageSelected={handleImageSelected}
            onGenerate={handleGenerate}
            onGetColorRecipe={handleGetColorRecipe}
        />
        <ImageDisplayWindow
            croppedImage={croppedImage}
            referenceImage={referenceImage}
            templateImage={templateImage}
            colorKeys={colorKeys}
            isProcessing={isProcessing}
            settings={{
              colorCount,
              medianFilterSize,
              mergeArea
            }}
            onColorCountChange={setColorCount}
            onMedianFilterSizeChange={setMedianFilterSize}
            onMergeAreaChange={setMergeArea}
            onOpenCrop={() => setIsCropModalOpen(true)}
        />

        {isEmptyImage && (<p>Please select an image before upload.</p>)}
        {isProcessing && (<p>{processMessage}</p>)}

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
  );
}

export default App;
