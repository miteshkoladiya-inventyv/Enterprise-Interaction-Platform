import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCw, Loader2 } from "lucide-react";

/**
 * Crop area → compressed Blob (JPEG).
 */
async function getCroppedAndCompressedImage(
  imageSrc,
  pixelCrop,
  rotation = 0,
  maxSize = 800,
  quality = 0.8
) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const rRad = (rotation * Math.PI) / 180;

  // Bounding box of the rotated image
  const sin = Math.abs(Math.sin(rRad));
  const cos = Math.abs(Math.cos(rRad));
  const bW = image.width * cos + image.height * sin;
  const bH = image.width * sin + image.height * cos;

  canvas.width = bW;
  canvas.height = bH;

  ctx.translate(bW / 2, bH / 2);
  ctx.rotate(rRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  // Extract crop area
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  );

  // Determine output size (cap to maxSize for compression)
  let outW = pixelCrop.width;
  let outH = pixelCrop.height;
  if (outW > maxSize || outH > maxSize) {
    const ratio = Math.min(maxSize / outW, maxSize / outH);
    outW = Math.round(outW * ratio);
    outH = Math.round(outH * ratio);
  }

  // Draw cropped area at final size
  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d");

  // Temporary canvas at crop size to putImageData
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = pixelCrop.width;
  tmpCanvas.height = pixelCrop.height;
  tmpCanvas.getContext("2d").putImageData(data, 0, 0);

  outCtx.drawImage(tmpCanvas, 0, 0, pixelCrop.width, pixelCrop.height, 0, 0, outW, outH);

  return new Promise((resolve) => {
    outCanvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      quality
    );
  });
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

const ImageCropModal = ({ open, onClose, imageSrc, onCropComplete }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropChange = useCallback((c) => setCrop(c), []);
  const onZoomChange = useCallback((z) => setZoom(z), []);

  const handleCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedAndCompressedImage(
        imageSrc,
        croppedAreaPixels,
        rotation,
        800,
        0.8
      );
      onCropComplete(blob);
    } catch (err) {
      console.error("Crop error:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 bg-zinc-900 border-zinc-800">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Crop Profile Picture</DialogTitle>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full h-[350px] bg-zinc-950">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-4 space-y-4">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut className="size-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="size-4 text-muted-foreground shrink-0" />
          </div>

          {/* Rotate */}
          <div className="flex items-center gap-3">
            <RotateCw className="size-4 text-muted-foreground shrink-0" />
            <Slider
              value={[rotation]}
              min={0}
              max={360}
              step={1}
              onValueChange={([v]) => setRotation(v)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {rotation}°
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                Processing…
              </>
            ) : (
              "Apply"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropModal;
