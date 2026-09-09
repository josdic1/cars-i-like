import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { ImageValidationError } from "./media/carImageProcessor.js";
import { carRouter } from "./cars/carRoutes.js";
import { carImageRouter } from "./media/carImageRoutes.js";
import { CarNotFoundError } from "./cars/carService.js";

export const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "cars-i-like"
  });
});

app.use("/api/cars", carImageRouter);
app.use("/api/cars", carRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Image exceeds the 10 MB upload limit"
        : `Invalid image upload: ${error.code} (${error.message})`
    });
    return;
  }

  if (error instanceof ImageValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      issues: error.issues
    });
    return;
  }

  if (error instanceof CarNotFoundError) {
    res.status(404).json({
      error: error.message
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: "Invalid JSON"
    });
    return;
  }

  console.error("Unhandled API error:", error);
  res.status(500).json({
    error: "Internal server error"
  });
};

app.use(errorHandler);
