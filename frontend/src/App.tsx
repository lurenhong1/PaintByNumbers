import { useRef, useState } from 'react';
import JSZip from 'jszip';
import { toPng } from 'html-to-image';
import type { ColorKey, Dimensions } from './types/images';
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
  const [filterLevel, setFilterLevel] = useState<number>(3);
  const [mergeLevel, setMergeLevel] = useState<number>(5);

  const [aspectRatio, setAspectRatio] = useState<number | undefined>();
  const [outputDimension, setOutputDimension] = useState<Dimensions>({ width: 1000, height: 1000});

  const colorSetsRef = useRef<HTMLDivElement>(null);

  function handleImageSelected(selectedImage: File) {
    setImageFile(selectedImage);

    const image = URL.createObjectURL(selectedImage);

    // console.log("Selected image:", selectedImage);
    setReferenceImage(null);
    setTemplateImage(null);
    setColorKeys([]);
    setInputImage(image);
    setCroppedImage(image);
  }

  async function handleGenerate(): Promise<void> {
    if (!imageFile) {
      setIsEmptyImage(true);
      return;
    }

    setIsEmptyImage(false);
    startProcess("Processing image...");

    try {
      const result = await processImage(imageFile, {
        colorCount,
        filterLevel,
        mergeLevel,
        outputDimension
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

    startProcess("Generating color recipes...");

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
    setReferenceImage(null);
    setTemplateImage(null);
    setColorKeys([]);
    setImageFile(croppedFile);
    setIsCropModalOpen(false);
  }

  function handleDownloadImage(imageUrl: string | null, filename: string) {
    if (!imageUrl) {
      return;
    }
    startProcess(`Downloading ${filename}...`);
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();
    endProcess();
  }

  async function handleDownloadColorSets() {
    if (!colorSetsRef.current) {
      return;
    }
    startProcess("Downloading color-sets.png...");
    try {
      const imageUrl = await toPng(colorSetsRef.current, {
        backgroundColor: "#dfdfdf",
        cacheBust: true,
        pixelRatio: 2,
      });

      handleDownloadImage(imageUrl, "color-sets.png");
    } catch (error) {
      console.error("Failed to create color sets image:", error);
    } finally {
      endProcess();
    }
  }

  async function imageUrlToBlob(imageUrl: string): Promise<Blob> {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error("Could not read image");
    }

    return response.blob();
  }

  function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Wait until the browser has started the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function handleDownloadAll(): Promise<void> {
    if (!referenceImage || !templateImage || !colorSetsRef.current) {
      return;
    }
    startProcess("Preparing downloads...");

    try {
      const colorSetsImage = await toPng(colorSetsRef.current, {
        backgroundColor: "#dfdfdf",
        cacheBust: true,
        pixelRatio: 2,
      });

      const [referenceBlob, templateBlob, colorSetsBlob] = await Promise.all([
        imageUrlToBlob(referenceImage),
        imageUrlToBlob(templateImage),
        imageUrlToBlob(colorSetsImage)
      ]);

      const zip = new JSZip();

      zip.file("reference.png", referenceBlob);
      zip.file("template.png", templateBlob);
      zip.file("color-sets.png", colorSetsBlob);

      const zipBlob = await zip.generateAsync({
        type: "blob",
      });

      downloadBlob(zipBlob, "paint-by-numbers.zip");
    } catch (error) {
      console.error("Failed to create ZIP:", error);
    } finally {
      endProcess();
    }
  }

  function startProcess(message: string) {
    setIsProcessing(true);
    setProcessMessage(message);
  }

  function endProcess() {
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
            canDownloadReference={referenceImage !== null}
            canDownloadTemplate={templateImage !== null}
            canDownloadColorSets={colorKeys.length > 0}
            canDownloadAll={referenceImage !== null && templateImage !== null && colorKeys.length > 0}
            onImageSelected={handleImageSelected}
            onGenerate={handleGenerate}
            onGetColorRecipe={handleGetColorRecipe}
            onDownloadReference={() => handleDownloadImage(referenceImage, "reference.png")}
            onDownloadTemplate={() => handleDownloadImage(templateImage, "template.png")}
            onDownloadColorSets={handleDownloadColorSets}
            onDownloadAll={handleDownloadAll}
        />
        <ImageDisplayWindow
            croppedImage={croppedImage}
            referenceImage={referenceImage}
            templateImage={templateImage}
            colorKeys={colorKeys}
            isProcessing={isProcessing}
            settings={{
              colorCount,
              filterLevel,
              mergeLevel,
              outputDimension
            }}
            onColorCountChange={setColorCount}
            onFilterLevelChange={setFilterLevel}
            onMergeLevelChange={setMergeLevel}
            onOutputDimensionChange={setOutputDimension}
            onOpenCrop={() => setIsCropModalOpen(true)}
            colorSetsRef={colorSetsRef}
        />

        {isEmptyImage && (<p>Please select an image before upload.</p>)}
        {isProcessing && (
            <div className="processing-overlay">
              <div
                  className="processing-status"
                  role="status"
                  aria-busy="true"
              >
                <span className="loading-spinner" aria-hidden="true" />
                <p>{processMessage}</p>
              </div>
            </div>
        )}

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
