import {
    useRef,
    type ChangeEvent,
    type WheelEvent,
} from 'react';
import './Toolbar.css';

type ToolbarProps = {
    isProcessing: boolean;
    canGenerate: boolean;
    canGetColorRecipe: boolean;
    canDownloadReference: boolean;
    canDownloadTemplate: boolean;
    canDownloadColorSets: boolean;
    canDownloadAll: boolean;
    onImageSelected: (file: File) => void;
    onGenerate: () => void;
    onGetColorRecipe: () => void;
    onDownloadReference: () => void;
    onDownloadTemplate: () => void;
    onDownloadColorSets: () => void;
    onDownloadAll: () => void;
};

function Toolbar({
    isProcessing,
    canGenerate,
    canGetColorRecipe,
    canDownloadReference,
    canDownloadTemplate,
    canDownloadColorSets,
    canDownloadAll,
    onImageSelected,
    onGenerate,
    onGetColorRecipe,
    onDownloadReference,
    onDownloadTemplate,
    onDownloadColorSets,
    onDownloadAll
}: ToolbarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
        const selectedImage = event.target.files?.[0];

        if (selectedImage) {
            onImageSelected(selectedImage);
        }
    }

    function handleWheel(event: WheelEvent<HTMLDivElement>) {
        const toolbar = event.currentTarget;

        if (toolbar.scrollWidth <= toolbar.clientWidth) {
            return;
        }

        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.preventDefault();
            toolbar.scrollLeft += event.deltaY;
        }
    }

    return (

        <div className="toolbar" onWheel={handleWheel}>
            <button
                type='button'
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
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
                onClick={onGenerate}
                disabled={!canGenerate || isProcessing}
            >
                Generate
            </button>

            <button
                type='button'
                className="btn"
                onClick={onGetColorRecipe}
                disabled={!canGetColorRecipe || isProcessing}
            >
                Get Color Recipe
            </button>

            <button
                type='button'
                className="btn"
                onClick={onDownloadReference}
                disabled={!canDownloadReference || isProcessing}
            >
                Download Referenced
            </button>

            <button
                type='button'
                className="btn"
                onClick={onDownloadTemplate}
                disabled={!canDownloadTemplate || isProcessing}
            >
                Download Template
            </button>

            <button
                type='button'
                className="btn"
                onClick={onDownloadColorSets}
                disabled={!canDownloadColorSets || isProcessing}
            >
                Download Color Sets
            </button>

            <button
                type='button'
                className="btn"
                onClick={onDownloadAll}
                disabled={!canDownloadAll || isProcessing}
            >
                Download All
            </button>
        </div>
    );
}

export default Toolbar;
