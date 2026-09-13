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
    onImageSelected: (file: File) => void;
    onGenerate: () => void;
    onGetColorRecipe: () => void;
};

function Toolbar({
    isProcessing,
    canGenerate,
    canGetColorRecipe,
    onImageSelected,
    onGenerate,
    onGetColorRecipe
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
    );
}

export default Toolbar;
