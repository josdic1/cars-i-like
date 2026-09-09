import type {
  Car,
  CreateCarInput,
  UpdateCarInput
} from "@cars-i-like/shared";
import { carSchema } from "@cars-i-like/shared";
import { pool } from "../db/pool.js";

const carColumns = `
  c.id,
  c.make,
  c.model,
  c.year,
  c.notes,
  c.created_at,
  c.updated_at,
  EXISTS (
    SELECT 1
    FROM car_images ci
    WHERE ci.car_id = c.id
  ) AS has_image
`;

function parseCar(row: unknown): Car {
  const { has_image, ...record } = row as Record<string, unknown>;

  return carSchema.parse({
    ...record,
    image_url: has_image === true
      ? `/api/cars/${record.id}/image`
      : null,
    created_at:
      record.created_at instanceof Date
        ? record.created_at.toISOString()
        : record.created_at,
    updated_at:
      record.updated_at instanceof Date
        ? record.updated_at.toISOString()
        : record.updated_at
  });
}

export async function listCars(): Promise<Car[]> {
  const result = await pool.query(`
    SELECT ${carColumns}
    FROM cars c
    ORDER BY c.created_at DESC, c.id DESC
  `);

  return result.rows.map(parseCar);
}

export async function findCarById(id: string): Promise<Car | null> {
  const result = await pool.query(
    `SELECT ${carColumns} FROM cars c WHERE c.id = $1`,
    [id]
  );

  const row = result.rows[0];
  return row ? parseCar(row) : null;
}

export async function createCar(input: CreateCarInput): Promise<Car> {
  const result = await pool.query(
    `
      WITH saved AS (
        INSERT INTO cars (make, model, year, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      )
      SELECT ${carColumns}
      FROM saved c
    `,
    [input.make, input.model, input.year, input.notes]
  );

  return parseCar(result.rows[0]);
}

export async function updateCar(
  id: string,
  input: UpdateCarInput
): Promise<Car | null> {
  const result = await pool.query(
    `
      WITH saved AS (
        UPDATE cars
        SET
          make = COALESCE($2, make),
          model = COALESCE($3, model),
          year = COALESCE($4, year),
          notes = COALESCE($5, notes)
        WHERE id = $1
        RETURNING *
      )
      SELECT ${carColumns}
      FROM saved c
    `,
    [
      id,
      input.make ?? null,
      input.model ?? null,
      input.year ?? null,
      input.notes ?? null
    ]
  );

  const row = result.rows[0];
  return row ? parseCar(row) : null;
}

export async function deleteCar(id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM cars WHERE id = $1`,
    [id]
  );

  return result.rowCount === 1;
}
