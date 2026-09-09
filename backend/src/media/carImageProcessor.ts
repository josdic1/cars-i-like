import sharp from "sharp";

export const MAX_CAR_IMAGE_BYTES = 10 * 1024 * 1024;

export type ProcessedCarImage = {
  data: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
};

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

const supportedFormats = new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "heif"
]);

export async function processCarImage(
  buffer: Buffer
): Promise<ProcessedCarImage> {
  if (buffer.length === 0 || buffer.length > MAX_CAR_IMAGE_BYTES) {
    throw new ImageValidationError("Image must be between 1 byte and 10 MB.");
  }

  try {
    const image = sharp(buffer, {
      limitInputPixels: 40_000_000,
      failOn: "warning"
    });

    const metadata = await image.metadata();

    if (!supportedFormats.has(metadata.format)) {
      throw new ImageValidationError("Unsupported image format.");
    }

    const { data, info } = await image
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });

    if (data.length === 0 || data.length > MAX_CAR_IMAGE_BYTES) {
      throw new ImageValidationError("Processed image exceeds the 10 MB limit.");
    }

    return {
      data,
      mimeType: "image/webp",
      width: info.width,
      height: info.height
    };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      throw error;
    }

    throw new ImageValidationError(
      "The image could not be processed. Use a supported photo format."
    );
  }
}
