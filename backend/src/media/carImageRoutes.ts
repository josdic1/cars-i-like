import { createHash } from "node:crypto";
import { carIdSchema } from "@cars-i-like/shared";
import { Router } from "express";
import multer from "multer";
import { findCarImageByCarId } from "./carImageRepository.js";
import { MAX_CAR_IMAGE_BYTES } from "./carImageProcessor.js";
import { uploadCarImage } from "./carImageService.js";

export const carImageRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CAR_IMAGE_BYTES,
    files: 1,
    fields: 0
  }
});

carImageRouter.post(
  "/:id/image",
  upload.single("image"),
  async (req, res) => {
    const car = await uploadCarImage(req.params.id, req.file);
    res.json(car);
  }
);

carImageRouter.get("/:id/image", async (req, res) => {
  const carId = carIdSchema.parse(req.params.id);
  const image = await findCarImageByCarId(carId);

  if (!image) {
    res.status(404).json({ error: "Car image not found" });
    return;
  }

  // The URL identifies the car's current image, which can be replaced.
  // Revalidate instead of retaining stale bytes after a replacement.
  const etag = `"${createHash("sha256").update(image.data).digest("hex")}"`;

  res.set({
    "Content-Type": image.mimeType,
    "Content-Length": String(image.data.length),
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
    ETag: etag
  });

  // A client may require cache revalidation with Cache-Control: no-cache.
  // That directive does not invalidate a matching If-None-Match validator.
  // Weak comparison is required for GET/HEAD conditional requests.
  const ifNoneMatch = req.headers["if-none-match"];
  const matches = ifNoneMatch?.split(",").some((candidate) => {
    const tag = candidate.trim();
    return tag === "*" || (tag.startsWith("W/") ? tag.slice(2) : tag) === etag;
  });

  if (matches) {
    res.status(304).end();
    return;
  }

  res.status(200).end(image.data);
});
