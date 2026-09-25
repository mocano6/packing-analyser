/** Grafika ćwiczenia wklejana do bloku mikrocyklu (data URL). */

export const BLOCK_IMAGE_MAX_SIDE = 900;
export const BLOCK_IMAGE_MAX_DATA_URL_LENGTH = 180_000;
/** Przy odczycie z Firestore zostawiamy trochę zapasu (stare, większe wklejki). */
export const BLOCK_IMAGE_STORED_MAX_LENGTH = 400_000;

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i;

export function isBlockImageDataUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 32 || trimmed.length > BLOCK_IMAGE_STORED_MAX_LENGTH) return false;
  return DATA_URL_RE.test(trimmed);
}

export function normalizeBlockImageUrl(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw).trim();
  return isBlockImageDataUrl(s) ? s : undefined;
}

export function isImageMimeType(type: string): boolean {
  return /^image\/(png|jpe?g|webp|gif)$/i.test(type);
}

export function pickClipboardImageType(types: readonly string[]): string | null {
  return types.find((t) => isImageMimeType(t)) ?? null;
}

export function scaledImageSize(
  width: number,
  height: number,
  maxSide: number
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  const cap = maxSide > 0 ? maxSide : BLOCK_IMAGE_MAX_SIDE;
  const scale = Math.min(1, cap / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Pierwszy obrazek z eventu wklejenia (Ctrl+V). */
export function imageBlobFromClipboardData(data: DataTransfer | null): Blob | null {
  if (!data) return null;
  const items = Array.from(data.items ?? []);
  for (const item of items) {
    if (item.kind === "file" && isImageMimeType(item.type)) {
      return item.getAsFile();
    }
  }
  const files = Array.from(data.files ?? []);
  for (const file of files) {
    if (isImageMimeType(file.type)) return file;
  }
  return null;
}

export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Nie udało się odczytać grafiki"));
    };
    reader.onerror = () => reject(new Error("Nie udało się odczytać grafiki"));
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nie udało się odczytać grafiki"));
    img.src = src;
  });
}

function drawToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  fillWhite: boolean
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (fillWhite) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/**
 * Kompresja wklejki: skalowanie + JPEG (diagramy też), z PNG jako fallback gdy jest mniejszy.
 * Odrzuca grafiki, które po kompresji nadal przekraczają limit dokumentu.
 */
export async function compressBlockImage(dataUrl: string): Promise<string> {
  const img = await loadHtmlImage(dataUrl);
  let maxSide = BLOCK_IMAGE_MAX_SIDE;
  let quality = 0.78;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { width, height } = scaledImageSize(img.naturalWidth, img.naturalHeight, maxSide);
    const jpegCanvas = drawToCanvas(img, width, height, true);
    const pngCanvas = drawToCanvas(img, width, height, false);
    if (!jpegCanvas) throw new Error("Nie udało się przetworzyć grafiki");

    const jpeg = jpegCanvas.toDataURL("image/jpeg", quality);
    const png = pngCanvas?.toDataURL("image/png") ?? jpeg;
    const next = png.length < jpeg.length ? png : jpeg;

    if (next.length <= BLOCK_IMAGE_MAX_DATA_URL_LENGTH) return next;
    maxSide = Math.round(maxSide * 0.7);
    quality = Math.max(0.45, quality - 0.12);
  }

  throw new Error("Grafika jest za duża — wklej mniejszy zrzut");
}

export async function readClipboardImageBlob(): Promise<Blob | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = pickClipboardImageType(item.types);
    if (!type) continue;
    return item.getType(type);
  }
  return null;
}
