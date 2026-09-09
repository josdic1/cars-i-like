import { carIdSchema } from "@cars-i-like/shared";
import { CarNotFoundError, getCar } from "../cars/carService.js";
import {
  ImageValidationError,
  processCarImage
} from "./carImageProcessor.js";
import { saveCarImage } from "./carImageRepository.js";

export async function uploadCarImage(
  id: unknown,
  file: Express.Multer.File | undefined
) {
  const carId = carIdSchema.parse(id);

  if (!file) {
    throw new ImageValidationError("Select an image to upload.");
  }

  const image = await processCarImage(file.buffer);
  const saved = await saveCarImage(carId, image);

  if (!saved) {
    throw new CarNotFoundError();
  }

  return getCar(carId);
}
