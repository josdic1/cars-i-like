import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import type { ProcessedCarImage } from "./carImageProcessor.js";

export type StoredCarImage = {
  data: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
};

type ImageRow = {
  image_data: Buffer;
  mime_type: string;
  width: number;
  height: number;
};

function parseStoredImage(row: ImageRow): StoredCarImage {
  if (
    !Buffer.isBuffer(row.image_data) ||
    row.mime_type !== "image/webp" ||
    !Number.isInteger(row.width) ||
    !Number.isInteger(row.height)
  ) {
    throw new Error("Invalid stored car image");
  }

  return {
    data: row.image_data,
    mimeType: "image/webp",
    width: row.width,
    height: row.height
  };
}

export async function findCarImageByCarId(
  carId: string
): Promise<StoredCarImage | null> {
  const result = await pool.query<ImageRow>(
    `
      SELECT image_data, mime_type, width, height
      FROM car_images
      WHERE car_id = $1
    `,
    [carId]
  );

  const row = result.rows[0];
  return row ? parseStoredImage(row) : null;
}

export async function saveCarImage(
  carId: string,
  image: ProcessedCarImage
): Promise<boolean> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const car = await client.query(
      "SELECT id FROM cars WHERE id = $1 FOR UPDATE",
      [carId]
    );

    if (car.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
        INSERT INTO car_images (
          car_id, image_data, mime_type, width, height
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (car_id)
        DO UPDATE SET
          image_data = EXCLUDED.image_data,
          mime_type = EXCLUDED.mime_type,
          width = EXCLUDED.width,
          height = EXCLUDED.height
      `,
      [
        carId,
        image.data,
        image.mimeType,
        image.width,
        image.height
      ]
    );

    await client.query(
      "UPDATE cars SET updated_at = now() WHERE id = $1",
      [carId]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
