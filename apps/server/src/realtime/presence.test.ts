import { describe, expect, it } from "vitest";
import { RoomPresenceManager } from "./presence";
import type { Connection } from "./connection";

describe("RoomPresenceManager", () => {
    it("coalesces multiple rapid updates within 50ms into a single batch with the latest value", async () => {
        const broadcasts: any[] = [];
        const manager = new RoomPresenceManager("test-room", (changes) => {
            broadcasts.push(changes);
        });

        const fakeConn = {
            id: "conn-1",
            userId: "user-1",
            userInfo: { name: "Bob", avatar: null, color: "#123456" },
        } as unknown as Connection;

        manager.onClientJoin(fakeConn);

        // Send 10 rapid cursor updates
        for (let i = 1; i <= 10; i++) {
            manager.onClientPresence(fakeConn, {
                cursor: { x: i * 10, y: i * 20 },
                thinking: i === 10,
            });
        }

        // Flush batch manually or trigger
        manager.flushBatch();

        expect(broadcasts).toHaveLength(1);
        const batch = broadcasts[0];
        expect(batch).toHaveLength(1);
        expect(batch[0].connectionId).toBe("conn-1");
        expect(batch[0].presence.cursor).toEqual({ x: 100, y: 200 });
        expect(batch[0].presence.thinking).toBe(true);

        manager.destroy();
    });

    it("stamps identity from connection userInfo, ignoring forged info from payload", () => {
        const broadcasts: any[] = [];
        const manager = new RoomPresenceManager("test-room", (changes) => {
            broadcasts.push(changes);
        });

        const fakeConn = {
            id: "conn-attacker",
            userId: "attacker-user-id",
            userInfo: { name: "RealAttacker", avatar: null, color: "#999999" },
        } as unknown as Connection;

        manager.onClientJoin(fakeConn);

        // Client attempts to pass fake info in payload
        manager.onClientPresence(fakeConn, {
            cursor: { x: 50, y: 50 },
            thinking: false,
            info: { name: "Plano", color: "#6457f9" },
        } as any);

        manager.flushBatch();

        expect(broadcasts[0][0].info.name).toBe("RealAttacker");
        expect(broadcasts[0][0].info.color).toBe("#999999");
        expect(broadcasts[0][0].userId).toBe("attacker-user-id");

        manager.destroy();
    });
});

describe("RoomPresenceManager: server-set presence", () => {
    it("drops Plano's cursor on its own when the TTL runs out, and tells the room", async () => {
        const expired: string[] = [];
        const manager = new RoomPresenceManager("room", () => {}, (id) => expired.push(id));

        manager.setAiPresence({ cursor: { x: 1, y: 1 }, thinking: true }, 0.06);
        expect(manager.getSnapshot().map((p) => p.userId)).toEqual(["plano"]);

        // Nobody asks for a snapshot: the manager's own timer must notice (a crashed task leaves nothing else to).
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(expired).toEqual(["ai:plano"]);
        expect(manager.getSnapshot()).toEqual([]);
        manager.destroy();
    });

    it("keeps Plano while its presence is refreshed", async () => {
        const expired: string[] = [];
        const manager = new RoomPresenceManager("room", () => {}, (id) => expired.push(id));

        for (let i = 0; i < 4; i++) {
            manager.setAiPresence({ cursor: null, thinking: true }, 0.12);
            await new Promise((resolve) => setTimeout(resolve, 60));
        }
        expect(expired).toEqual([]);
        manager.destroy();
    });

    it("includes presence other instances reported when a newcomer asks who is here", () => {
        const manager = new RoomPresenceManager("room", () => {});
        manager.applyRemote([
            { connectionId: "remote-1", userId: "u-remote", info: { name: "Remote", color: "#fff" }, presence: { cursor: { x: 1, y: 2 }, thinking: false } },
        ]);
        expect(manager.getSnapshot().map((p) => p.connectionId)).toEqual(["remote-1"]);

        manager.removeRemote("remote-1");
        expect(manager.getSnapshot()).toEqual([]);
        manager.destroy();
    });
});
