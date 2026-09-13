import {useEffect, useRef, useState} from "react";
import ReactCrop, {
    centerCrop, convertToPixelCrop, cropToCanvas,
    makeAspectCrop,
    type PercentCrop
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './ImageCropModal.css';

type ImageCropModalProps = {
    imageUrl: string;
    aspectRatio: number | undefined;
    onAspectRatioChange: (ratio: number | undefined) => void;
    onApply: (croppedImage: Blob) => void;
    onCancel: () => void;
};

function ImageCropModal({imageUrl, aspectRatio, onAspectRatioChange, onApply, onCancel}: ImageCropModalProps) {
    const imageRef = useRef<HTMLImageElement>(null);

    const [crop, setCrop] = useState<PercentCrop>({
        unit: '%',
        x: 10,
        y: 10,
        width: 80,
        height: 80,
    });

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onCancel();
            }
        }

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onCancel]);

    function createCenteredCrop(image: HTMLImageElement, aspect: number): PercentCrop {
        const { naturalWidth, naturalHeight } = image;

        return centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 80
                },
                aspect,
                naturalWidth,
                naturalHeight
            ),
            naturalWidth,
            naturalHeight
        );
    }

    function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
        if (aspectRatio === undefined) {
            return;
        }
        setCrop(createCenteredCrop(event.currentTarget, aspectRatio));
    }

    function handleAspectRatioChange(value: string) {
        const nextAspect = value === 'free' ? undefined : Number(value);

        onAspectRatioChange(nextAspect);

        if (nextAspect !== undefined && imageRef.current) {
            setCrop(createCenteredCrop(imageRef.current, nextAspect));
        }
    }

    async function handleApply() {
        const image = imageRef.current;

        if (!image) {
            return;
        }

        const pixelCrop = convertToPixelCrop(
            crop,
            image.width,
            image.height
        );

        const canvas = document.createElement('canvas');

        await cropToCanvas(image, canvas, pixelCrop);

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(new Error('Failed to create cropped image'));
                }
            }, 'image/png')
        });

        await onApply(blob);
    }

    return (
        <div
            className="crop-modal-backdrop"
            onMouseDown={onCancel}
        >
            <section
                className="crop-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="crop-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="crop-modal-header">
                    <h2 id="crop-modal-title">Crop Image</h2>

                    <button
                        type="button"
                        className="crop-modal-close"
                        aria-label="Close crop window"
                        onClick={onCancel}
                    >
                        ×
                    </button>
                </header>

                <div className="crop-modal-content">
                    <div className="crop-image-container">
                        <ReactCrop
                            crop={crop}
                            aspect={aspectRatio}
                            keepSelection
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                        >
                            <img
                                ref={imageRef}
                                src={imageUrl}
                                alt="Image being cropped"
                                className="crop-image"
                                onLoad={handleImageLoad}
                            />
                        </ReactCrop>
                    </div>

                    <label className="crop-ratio-control">
                        Aspect ratio

                        <select
                            value={aspectRatio ?? 'free'}
                            onChange={(event) => {
                                handleAspectRatioChange(event.currentTarget.value);
                            }}
                        >
                            <option value="free">Free</option>
                            <option value={1}>1:1</option>
                            <option value={4 / 3}>4:3</option>
                            <option value={3 / 2}>3:2</option>
                            <option value={16 / 9}>16:9</option>
                            <option value={3 / 4}>3:4</option>
                            <option value={2 / 3}>2:3</option>
                            <option value={9 / 16}>9:16</option>
                        </select>
                    </label>
                </div>

                <footer className="crop-modal-actions">
                    <button type="button" className="btn" onClick={onCancel}>
                        Cancel
                    </button>

                    <button type="button" className="btn" onClick={handleApply}>
                        Apply Crop
                    </button>
                </footer>
            </section>
        </div>
    );
}

export default ImageCropModal;
