import { Router } from "express";
import * as cars from "./carService.js";

export const carRouter = Router();

carRouter.get("/", async (_req, res) => {
  const result = await cars.listCars();
  res.json(result);
});

carRouter.post("/", async (req, res) => {
  const car = await cars.createCar(req.body);
  res.status(201).json(car);
});

carRouter.get("/:id", async (req, res) => {
  const car = await cars.getCar(req.params.id);
  res.json(car);
});

carRouter.patch("/:id", async (req, res) => {
  const car = await cars.updateCar(req.params.id, req.body);
  res.json(car);
});

carRouter.delete("/:id", async (req, res) => {
  await cars.deleteCar(req.params.id);
  res.status(204).send();
});
