// Client-side image preparation for iPhone uploads:
// - HEIC/HEIF -> JPEG
// - Apply EXIF orientation via createImageBitmap(imageOrientation: "from-image") when supported
// - Resize down (max dimension) + compress
// - Canvas export removes EXIF metadata (including GPS) by default

import heic2any from "heic2any";

export type PreparedImage = {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
};

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("toBlob_failed"));
      resolve(blob);
    }, type, quality);
  });
}

async function decodeImage(blob: Blob): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  // createImageBitmap supports EXIF orientation options in many modern browsers
  // Use a loose cast to avoid TS lib differences.
  const opts: any = { imageOrientation: "from-image" };
  const bitmap = await createImageBitmap(blob as any, opts);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

export async function prepareImageForUpload(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<PreparedImage> {
  const maxDim = opts.maxDim ?? 2048;
  const quality = opts.quality ?? 0.82;

  let blob: Blob = file;

  if (isHeic(file)) {
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    blob = Array.isArray(converted) ? converted[0] : (converted as Blob);
  }

  const { bitmap, width, height } = await decodeImage(blob);

  const scale = Math.min(1, maxDim / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas_context");

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const outBlob = await canvasToBlob(canvas, "image/jpeg", quality);

  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  const outFile = new File([outBlob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  const previewUrl = URL.createObjectURL(outBlob);

  return {
    file: outFile,
    previewUrl,
    width: targetW,
    height: targetH,
  };
}
