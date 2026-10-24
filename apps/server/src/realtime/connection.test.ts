import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { CLOSE } from "@repo/types";
import { Connection, TokenBucket } from "./connection";

class FakeSocket extends EventEmitter {
    readyState: number = WebSocket.OPEN;
    bufferedAmount = 0;
    pings = 0;
    terminated = false;
    closedWith: number | null = null;
    sent: unknown[] = [];
    ping() {
        this.pings++;
    }
    terminate() {
        this.terminated = true;
        this.readyState = WebSocket.CLOSED;
        this.emit("close");
    }
    close(code: number) {
        this.closedWith = code;
    }
    send(data: unknown) {
        this.sent.push(data);
    }
}

const ticket = { userId: "u", roomId: "r", userInfo: { name: "U", color: "#fff", avatar: null } };

describe("Connection heartbeat", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("terminates a socket that missed the previous pong", () => {
        const ws = new FakeSocket();
        const conn = new Connection(ws as unknown as WebSocket, ticket, "c1", 1000);

        vi.advanceTimersByTime(1000); // ping sent, now waiting for a pong
        expect(ws.pings).toBe(1);
        expect(ws.terminated).toBe(false);

        vi.advanceTimersByTime(1000); // no pong arrived
        expect(ws.terminated).toBe(true);
        expect(conn.closed).toBe(true);
    });

    it("keeps a socket that answers", () => {
        const ws = new FakeSocket();
        new Connection(ws as unknown as WebSocket, ticket, "c1", 1000);

        for (let i = 0; i < 5; i++) {
            vi.advanceTimersByTime(1000);
            ws.emit("pong");
        }
        expect(ws.terminated).toBe(false);
        expect(ws.pings).toBe(5);
    });

    it("stops pinging once the socket has closed", () => {
        const ws = new FakeSocket();
        new Connection(ws as unknown as WebSocket, ticket, "c1", 1000);
        ws.readyState = WebSocket.CLOSED;
        ws.emit("close");

        vi.advanceTimersByTime(10_000);
        expect(ws.pings).toBe(0);
    });
});

describe("Connection buffering and backpressure", () => {
    it("holds frames that arrive before a room attaches and replays them in order", () => {
        const ws = new FakeSocket();
        const conn = new Connection(ws as unknown as WebSocket, ticket, "c1");
        ws.emit("message", Buffer.from("one"), false);
        ws.emit("message", Buffer.from("two"), false);

        const seen: string[] = [];
        conn.attach((raw) => seen.push(raw.toString()), () => {});
        ws.emit("message", Buffer.from("three"), false);
        expect(seen).toEqual(["one", "two", "three"]);
        conn.terminate();
    });

    it("does not crash on a socket error event", () => {
        const ws = new FakeSocket();
        const conn = new Connection(ws as unknown as WebSocket, ticket, "c1");
        expect(() => ws.emit("error", new Error("Max payload size exceeded"))).not.toThrow();
        conn.terminate();
    });

    it("drops presence frames first when the socket is backed up, but still sends document frames", () => {
        const ws = new FakeSocket();
        const conn = new Connection(ws as unknown as WebSocket, ticket, "c1");
        ws.bufferedAmount = 600_000;

        conn.sendJson({ t: "presence:batch", changes: [] });
        expect(ws.sent).toHaveLength(0);

        conn.sendJson({ t: "saved", timestamp: 1 });
        expect(ws.sent).toHaveLength(1);
        conn.terminate();
    });

    it("closes a socket that stays backed up for over 10 seconds, not before", () => {
        vi.useFakeTimers();
        try {
            const ws = new FakeSocket();
            const conn = new Connection(ws as unknown as WebSocket, ticket, "c1");
            ws.bufferedAmount = 2_000_000;

            conn.sendJson({ t: "saved", timestamp: 1 });
            expect(ws.closedWith).toBeNull();

            vi.advanceTimersByTime(11_000);
            conn.sendJson({ t: "saved", timestamp: 2 });
            expect(ws.closedWith).toBe(CLOSE.TOO_LARGE);
            conn.terminate();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("TokenBucket", () => {
    it("allows a burst, then refills over time", () => {
        vi.useFakeTimers();
        try {
            const bucket = new TokenBucket(3, 1);
            expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, true, false]);
            vi.advanceTimersByTime(2000);
            expect([bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, false]);
        } finally {
            vi.useRealTimers();
        }
    });
});
