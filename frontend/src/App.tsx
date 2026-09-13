import { useState } from 'react';
import type { ColorKey } from './types/images';
import './App.css';
import ImageCropModal from './components/ImageCropModal/ImageCropModal.tsx';
import { getColorRecipes, processImage } from './api/imagesApi';
import Toolbar from "./components/Toolbar/Toolbar.tsx";
import ImageDisplayWindow from "./components/ImageDisplayWindow/ImageDisplayWindow.tsx";

function App() {
  const [inputImage, setInputImage] = useState<string|null>(null);
  const [croppedImage, setCroppedImage] = useState<string|null>(null);
  const [templateImage, setTemplateImage] = useState<string|null>(null);
  const [referenceImage, setReferenceImage] = useState<string|null>(null);
  const [colorKeys, setColorKeys] = useState<ColorKey[]>([]);

  const [processing, setProcessing] = useState<boolean>(false);
  const [processMessage, setProcessMessage] = useState<string>('');
  const [imageFile, setImageFile] = useState<File|null>(null);
  const [emptyImage, setEmptyImage] = useState<boolean>(false);

  const [colorCount, setColorCount] = useState<number>(20);
  const [medianFilterSize, setMedianFilterSize] = useState<number>(7);
  const [mergeArea, setMergeArea] = useState<number>(500);

  const [aspectRatio, setAspectRatio] = useState<number | undefined>();

  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);

  function handleImageSelected(selectedImage: File) {
    setImageFile(selectedImage);

    const image = URL.createObjectURL(selectedImage);

    // console.log("Selected image:", selectedImage);
    setInputImage(image);
    setCroppedImage(image);
  }

  async function handleGenerate(): Promise<void> {
    if (!imageFile) {
      setEmptyImage(true);
      return;
    }

    setEmptyImage(false);
    startProcess("Image Processing");

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
      endProcess();
    }
  }

  async function handleGetColorRecipe(): Promise<void> {
    if (colorKeys.length === 0) {
      return;
    }

    startProcess("Generating Color Recipe");

    try {
      const result = await getColorRecipes(colorKeys);
      setColorKeys(result.colorKeys);
    } catch (error) {
      console.error("Failed to generate color recipes: ", error);
    } finally {
      endProcess();
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

  function startProcess(message: string) {
    setProcessing(true);
    setProcessMessage(message);
  }

  function endProcess() {
    setProcessing(false);
    setProcessMessage('');
  }

  function onCancel() {
    setIsCropModalOpen(false);
  }

  return (
    <>
      <section className="main">
        <Toolbar
            processing={processing}
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
            processing={processing}
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
  );
}

export default App;
