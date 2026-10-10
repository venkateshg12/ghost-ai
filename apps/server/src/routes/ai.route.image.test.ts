import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startImageDesignHandler } from "../controllers/ai.controller";
import { errorHandler } from "../middleware/errorHandler";
import { imageBody } from "./ai.route";

/*
  The upload endpoint's guards, exercised over real HTTP. Every case here is rejected before the service
  (database, storage, Trigger.dev) is reached, so the test needs none of them.
 */
const ROOM = "11111111-1111-4111-8111-111111111111";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let server: Server;
let base = "";

beforeAll(async () => {
    const app = express();
    app.use((req, _res, next) => {
        req.userId = "user-1";
        next();
    });
    app.post("/design-from-image", imageBody, startImageDesignHandler);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
    });
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const upload = (query: string, body: string | Buffer | null, contentType: string) =>
    fetch(`${base}/design-from-image?${query}`, { method: "POST", headers: { "content-type": contentType }, body: body === null ? null : new Uint8Array(typeof body === "string" ? Buffer.from(body) : body) });

describe("POST /design-from-image guards", () => {
    it("rejects an SVG, which could carry scripts, by content type", async () => {
        const res = await upload(`roomId=${ROOM}`, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/svg+xml");
        expect(res.status).toBe(415);
    });

    it("rejects a request with no image body", async () => {
        const res = await upload(`roomId=${ROOM}`, null, "image/png");
        expect(res.status).toBe(415);
    });

    it("rejects a file that claims to be a PNG but is not", async () => {
        const res = await upload(`roomId=${ROOM}`, Buffer.from("<html>not an image</html>"), "image/png");
        expect(res.status).toBe(400);
        expect(((await res.json()) as { errors: { message: string }[] }).errors[0]!.message).toMatch(/not a PNG, JPEG or WebP/);
    });

    it("rejects an image over 4 MB with 413, not a generic 500", async () => {
        const big = Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024 + 1)]);
        const res = await upload(`roomId=${ROOM}`, big, "image/png");
        expect(res.status).toBe(413);
    });

    it("rejects a missing or malformed room id before looking at the image", async () => {
        expect((await upload("", PNG, "image/png")).status).toBe(400);
        expect((await upload("roomId=not-a-uuid", PNG, "image/png")).status).toBe(400);
    });

    it("rejects an over-long instruction", async () => {
        const res = await upload(`roomId=${ROOM}&prompt=${"x".repeat(501)}`, PNG, "image/png");
        expect(res.status).toBe(400);
    });
});
