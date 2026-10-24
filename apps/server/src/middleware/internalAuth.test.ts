import { describe, expect, it, vi } from "vitest";
import { internalAuth } from "./internalAuth";
import { INTERNAL_API_SECRET } from "../constants/env";

describe("internalAuth", () => {
    it("rejects request with missing or malformed Authorization header", () => {
        const req: any = { headers: {} };
        const status = vi.fn().mockReturnThis();
        const json = vi.fn();
        const res: any = { status, json };
        const next = vi.fn();

        internalAuth(req, res, next);
        expect(status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("rejects request with invalid token", () => {
        const req: any = { headers: { authorization: "Bearer wrong-token-12345" } };
        const status = vi.fn().mockReturnThis();
        const json = vi.fn();
        const res: any = { status, json };
        const next = vi.fn();

        internalAuth(req, res, next);
        expect(status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("accepts request with valid INTERNAL_API_SECRET bearer token", () => {
        const req: any = { headers: { authorization: `Bearer ${INTERNAL_API_SECRET}` } };
        const status = vi.fn().mockReturnThis();
        const json = vi.fn();
        const res: any = { status, json };
        const next = vi.fn();

        internalAuth(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(status).not.toHaveBeenCalled();
    });
});
