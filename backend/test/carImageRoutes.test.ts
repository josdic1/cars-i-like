import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test, mock } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import sharp from "sharp";
import { pool } from "../src/db/pool.js";
import { app } from "../src/app.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const missingId = "123e4567-e89b-42d3-a456-426614174001";
const car = {
  id,
  make: "Land Rover",
  model: "Series I",
  year: 1948,
  notes: "",
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-01T00:00:00Z")
};
let stored: Buffer | null = null;
let writes = 0;
let server: Server;
let base: string;

function result(rows: unknown[] = [], rowCount = rows.length) {
  return { rows, rowCount };
}

// A fake PostgreSQL connection exercises the real Express routes, Sharp
// processor, storage repository, and service without touching a user's DB.
async function query(sql: string, params: unknown[] = []) {
  if (sql.includes("FROM car_images") && sql.includes("image_data")) {
    return result(stored && params[0] === id
      ? [{ image_data: stored, mime_type: "image/webp", width: 2, height: 2 }]
      : []);
  }
  if (sql.includes("FROM cars") && sql.includes("FOR UPDATE")) {
    return result(params[0] === id ? [{ id }] : []);
  }
  if (sql.includes("INSERT INTO car_images")) {
    stored = Buffer.from(params[1] as Buffer);
    writes++;
    return result([], 1);
  }
  if (sql.includes("SELECT") && sql.includes("FROM cars")) {
    const requestedId = params[0];
    return result(requestedId === id
      ? [{ ...car, has_image: stored !== null }]
      : []);
  }
  if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql.trim()) ||
      sql.includes("UPDATE cars SET updated_at")) {
    return result([], 1);
  }
  throw new Error(`Unexpected SQL: ${sql}`);
}

async function request(path: string, init?: RequestInit) {
  return fetch(base + path, init);
}

before(async () => {
  mock.method(pool, "query", query as typeof pool.query);
  mock.method(pool, "connect", async () => ({
    query,
    release() {}
  }) as Awaited<ReturnType<typeof pool.connect>>);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
  mock.restoreAll();
});

test("missing and invalid image IDs return 404 and 400", async () => {
  const missing = await request(`/api/cars/${missingId}/image`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "Car image not found");

  const invalid = await request("/api/cars/not-a-uuid/image");
  assert.equal(invalid.status, 400);
});

test("upload stores processed bytes; GET returns the same bytes", async () => {
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#ff0000" }
  }).png().toBuffer();
  const form = new FormData();
  form.append("image", new Blob([png], { type: "image/png" }), "car.png");

  const upload = await request(`/api/cars/${id}/image`, {
    method: "POST",
    body: form
  });
  assert.equal(upload.status, 200);
  const savedCar = await upload.json();
  assert.equal(savedCar.image_url, `/api/cars/${id}/image`);
  assert.equal(writes, 1);
  assert.ok(stored);

  const image = await request(savedCar.image_url);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/webp");
  assert.equal(image.headers.get("content-length"), String(stored!.length));
  assert.equal(image.headers.get("cache-control"), "private, no-cache");
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), stored);
  assert.equal(
    image.headers.get("etag"),
    `"${createHash("sha256").update(stored!).digest("hex")}"`
  );

  const head = await request(savedCar.image_url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), String(stored!.length));
  assert.equal((await head.arrayBuffer()).byteLength, 0);

  const cached = await request(savedCar.image_url, {
    headers: { "If-None-Match": image.headers.get("etag")! }
  });
  assert.equal(cached.status, 304);
  assert.equal((await cached.arrayBuffer()).byteLength, 0);

  const forced = await request(savedCar.image_url, {
    headers: {
      "If-None-Match": image.headers.get("etag")!,
      "Cache-Control": "no-cache"
    }
  });
  assert.equal(forced.status, 304);

  const weak = await request(savedCar.image_url, {
    headers: { "If-None-Match": `W/${image.headers.get("etag")!}` }
  });
  assert.equal(weak.status, 304);

  const mismatch = await request(savedCar.image_url, {
    headers: { "If-None-Match": '"different"' }
  });
  assert.equal(mismatch.status, 200);
  assert.deepEqual(Buffer.from(await mismatch.arrayBuffer()), stored);
});

test("replacement changes the ETag and returns the new image", async () => {
  const old = Buffer.from(stored!);
  const oldTag = `"${createHash("sha256").update(old).digest("hex")}"`;
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#0000ff" }
  }).png().toBuffer();
  const form = new FormData();
  form.append("image", new Blob([png], { type: "image/png" }), "new.png");

  const upload = await request(`/api/cars/${id}/image`, {
    method: "POST", body: form
  });
  assert.equal(upload.status, 200);
  assert.equal(writes, 2);
  assert.notDeepEqual(stored, old);

  const image = await request(`/api/cars/${id}/image`, {
    headers: { "If-None-Match": oldTag }
  });
  assert.equal(image.status, 200);
  assert.notEqual(image.headers.get("etag"), oldTag);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), stored);
});

test("invalid uploads never replace the existing image", async () => {
  const previous = Buffer.from(stored!);
  const count = writes;
  const form = new FormData();
  form.append("image", new Blob(["not an image"]), "bad.png");
  const response = await request(`/api/cars/${id}/image`, {
    method: "POST", body: form
  });
  assert.equal(response.status, 400);
  assert.deepEqual(stored, previous);
  assert.equal(writes, count);
});
