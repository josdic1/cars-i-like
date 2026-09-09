import { z } from "zod";

const carDetailsSchema = z.strictObject({
  make: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  year: z.number().int().min(1886).max(9999),
  notes: z.string().max(20000).default("")
});

export const createCarSchema = carDetailsSchema;

export const updateCarSchema = carDetailsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: "At least one field must be provided"
  });

export const carIdSchema = z.uuid();

export const carSchema = carDetailsSchema.safeExtend({
  id: carIdSchema,
  image_url: z.string().min(1).nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true })
});

export type CreateCarInput = z.infer<typeof createCarSchema>;
export type UpdateCarInput = z.infer<typeof updateCarSchema>;
export type Car = z.infer<typeof carSchema>;
