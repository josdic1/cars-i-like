import {
  carIdSchema,
  createCarSchema,
  updateCarSchema
} from "@cars-i-like/shared";
import * as repository from "./carRepository.js";

export class CarNotFoundError extends Error {
  constructor() {
    super("Car not found");
    this.name = "CarNotFoundError";
  }
}

export async function listCars() {
  return repository.listCars();
}

export async function getCar(id: unknown) {
  const carId = carIdSchema.parse(id);
  const car = await repository.findCarById(carId);

  if (!car) {
    throw new CarNotFoundError();
  }

  return car;
}

export async function createCar(input: unknown) {
  const details = createCarSchema.parse(input);
  return repository.createCar(details);
}

export async function updateCar(id: unknown, input: unknown) {
  const carId = carIdSchema.parse(id);
  const details = updateCarSchema.parse(input);
  const car = await repository.updateCar(carId, details);

  if (!car) {
    throw new CarNotFoundError();
  }

  return car;
}

export async function deleteCar(id: unknown) {
  const carId = carIdSchema.parse(id);
  const deleted = await repository.deleteCar(carId);

  if (!deleted) {
    throw new CarNotFoundError();
  }
}
