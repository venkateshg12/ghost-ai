import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { WebSocket } from "ws";
import { CLOSE, getDocEdgesMap } from "@repo/types";
import {
    FRAME,
    connectClient,
    createManager,
    getDocNodesMap,
    makeNode,
    nodeIds,
    sleep,
    startGateway,
    waitFor,
    writeNode,
    type TestClient,
} from "./testing";
import { issueTicket } from "./tickets";

const opened: { close: () => void }[] = [];
const track = <T extends { close: () => void }>(item: T) => {
    opened.push(item);
    return item;
};
afterEach(() => {
    for (const item of opened.splice(0)) {
        try {
            item.close();
        } catch {
            // already closed
        }
    }
});

const seededManager = (delayMs: number) => {
    const roomId = crypto.randomUUID();
    const { manager, store } = createManager({
        load: async () => {
            await sleep(delayMs);
            const doc = new Y.Doc();
            writeNode(getDocNodesMap(doc), makeNode("server-node", 5, 5));
            return doc;
        },
    });
    return { roomId, manager, store };
};

describe("gateway: upgrade checks", () => {
    it("rejects an Origin that is not in CORS_ORIGIN", async () => {
        const { manager } = createManager();
        const gw = track(await startGateway(manager));
        await expect(connectClient(gw.port, crypto.randomUUID(), { origin: "https://evil.example" })).rejects.toThrow("HTTP 403");
    });

    it("rejects a request with no Origin header", async () => {
        const { manager } = createManager();
        const gw = track(await startGateway(manager));
        await expect(connectClient(gw.port, crypto.randomUUID(), { origin: null })).rejects.toThrow("HTTP 403");
    });

    it("rejects a missing, bogus or reused ticket with 401", async () => {
        const { manager } = createManager();
        const gw = track(await startGateway(manager));
        const attempt = (ticket: string) =>
            new Promise<number>((resolve) => {
                const ws = new WebSocket(`ws://127.0.0.1:${gw.port}/realtime?ticket=${ticket}`, { headers: { Origin: "http://localhost:3000" } });
                ws.on("unexpected-response", (_r, res) => resolve(res.statusCode ?? 0));
                ws.on("open", () => resolve(101));
                ws.on("error", () => {});
            });

        expect(await attempt("")).toBe(401);
        expect(await attempt("not-a-real-ticket")).toBe(401);

        const roomId = crypto.randomUUID();
        const ticket = await issueTicket({ userId: "u", roomId, userInfo: { name: "U", color: "#fff", avatar: null } }, { set: async () => { throw new Error("x"); } } as never);
        expect(await attempt(ticket)).toBe(101);
        expect(await attempt(ticket)).toBe(401);
    });

    it("destroys upgrades for any other path", async () => {
        const { manager } = createManager();
        const gw = track(await startGateway(manager));
        const outcome = await new Promise<string>((resolve) => {
            const ws = new WebSocket(`ws://127.0.0.1:${gw.port}/other`, { headers: { Origin: "http://localhost:3000" } });
            ws.on("open", () => resolve("open"));
            ws.on("error", () => resolve("refused"));
        });
        expect(outcome).toBe("refused");
    });
});

describe("gateway: joining a room", () => {
    it("delivers the server's document when the room loads quickly", async () => {
        const { roomId, manager } = seededManager(0);
        const gw = track(await startGateway(manager));
        const client = track(await connectClient(gw.port, roomId));
        await waitFor(() => client.syncStep2 > 0);
        expect(nodeIds(client.doc)).toEqual(["server-node"]);
    });

    // Regression: the browser sends SYNC_STEP1 the moment the socket opens, long before a cold room has loaded.
    // Those frames used to be dropped, leaving the client with an empty canvas and no way to recover.
    it("delivers the server's document when the room is still loading as the client connects", async () => {
        const { roomId, manager } = seededManager(150);
        const gw = track(await startGateway(manager));
        const client = track(await connectClient(gw.port, roomId));
        await waitFor(() => client.syncStep2 > 0);
        expect(nodeIds(client.doc)).toEqual(["server-node"]);
        expect(client.frames[0]).toBe("json:hello");
    });

    it("sends hello with the connection id before the sync handshake", async () => {
        const { roomId, manager } = seededManager(0);
        const gw = track(await startGateway(manager));
        const client = track(await connectClient(gw.port, roomId));
        await waitFor(() => client.syncStep2 > 0);
        expect(client.frames.indexOf("json:hello")).toBeLessThan(client.frames.indexOf("bin:0"));
    });

    it("merges edits a client made offline when it connects", async () => {
        const { roomId, manager } = seededManager(0);
        const gw = track(await startGateway(manager));

        const offline = new Y.Doc();
        writeNode(getDocNodesMap(offline), makeNode("made-offline", 9, 9));

        const client = track(await connectClient(gw.port, roomId, { doc: offline }));
        await waitFor(() => client.syncStep2 > 0);
        await waitFor(() => getDocNodesMap(manager.getRoom(roomId)!.doc).has("made-offline"));

        expect(nodeIds(manager.getRoom(roomId)!.doc)).toEqual(["made-offline", "server-node"]);
        expect(nodeIds(client.doc)).toEqual(["made-offline", "server-node"]);
    });

    it("caps the sockets one user can hold in a room", async () => {
        const { roomId, manager } = seededManager(0);
        const gw = track(await startGateway(manager));
        const clients: TestClient[] = [];
        for (let i = 0; i < 10; i++) clients.push(track(await connectClient(gw.port, roomId, { userId: "same-user" })));
        await waitFor(() => manager.getRoom(roomId)?.connections.size === 10);

        const eleventh = track(await connectClient(gw.port, roomId, { userId: "same-user" }));
        await waitFor(() => eleventh.closeCode !== null);
        expect(eleventh.closeCode).toBe(CLOSE.RATE_LIMITED);
        expect(manager.getRoom(roomId)!.connections.size).toBe(10);
    });
});

describe("gateway: guards on what a client writes", () => {
    it("closes a frame over the limit with 4413 (not ws's generic 1009)", async () => {
        const { roomId, manager } = seededManager(0);
        const gw = track(await startGateway(manager));
        const client = track(await connectClient(gw.port, roomId));
        await waitFor(() => client.syncStep2 > 0);

        client.send(new Uint8Array(2_000_000).fill(FRAME.UPDATE));
        await waitFor(() => client.closeCode !== null);
        expect(client.closeCode).toBe(CLOSE.TOO_LARGE);
    });

    it("quarantines a malformed node, removes it for everyone, and closes the sender", async () => {
        const { roomId, manager } = seededManager(0);
        const gw = track(await startGateway(manager));
        const attacker = track(await connectClient(gw.port, roomId, { userId: "attacker" }));
        const bystander = track(await connectClient(gw.port, roomId, { userId: "bystander" }));
        await waitFor(() => attacker.syncStep2 > 0 && bystander.syncStep2 > 0);

        attacker.update(() => {
            const nodes = getDocNodesMap(attacker.doc);
            writeNode(nodes, makeNode("fine", 1, 1));
            writeNode(nodes, { ...makeNode("bad", 1, 1), position: { x: 1e12, y: 0 } });
        });

        await waitFor(() => attacker.closeCode !== null);
        expect(attacker.closeCode).toBe(CLOSE.TOO_LARGE);

        const server = manager.getRoom(roomId)!.doc;
        await waitFor(() => !getDocNodesMap(server).has("bad"));
        expect(nodeIds(server)).toEqual(["fine", "server-node"]);
        await waitFor(() => !getDocNodesMap(bystander.doc).has("bad"));
    });

    it("quarantines an edge whose id does not match its key", async () => {
        const { roomId, manager } = seededManager(0);
        const gw = track(await startGateway(manager));
        const attacker = track(await connectClient(gw.port, roomId));
        await waitFor(() => attacker.syncStep2 > 0);

        attacker.update(() => {
            const edge = new Y.Map<unknown>();
            getDocEdgesMap(attacker.doc).set("edge-1", edge);
            edge.set("id", "someone-elses-id");
            edge.set("type", "canvasEdge");
            edge.set("source", "a");
            edge.set("target", "b");
        });

        await waitFor(() => attacker.closeCode !== null);
        expect(getDocEdgesMap(manager.getRoom(roomId)!.doc).has("edge-1")).toBe(false);
    });

    it("ignores identity a client puts in its presence frame", async () => {
        const { roomId, manager } = seededManager(0);
        const gw = track(await startGateway(manager));
        const sender = track(await connectClient(gw.port, roomId, { userId: "real-user", name: "Real Name" }));
        const watcher = track(await connectClient(gw.port, roomId, { userId: "watcher" }));
        await waitFor(() => sender.syncStep2 > 0 && watcher.syncStep2 > 0);

        sender.ws.send(JSON.stringify({ t: "presence", presence: { cursor: { x: 3, y: 4 }, thinking: false }, info: { name: "Plano" }, userId: "plano" }));
        await waitFor(() =>
            watcher.json.some((f) => f.t === "presence:batch" && f.changes.some((c) => c.presence.cursor?.x === 3))
        );
        const change = watcher.json
            .flatMap((f) => (f.t === "presence:batch" ? f.changes : []))
            .find((c) => c.presence.cursor?.x === 3)!;
        expect(change.userId).toBe("real-user");
        expect(change.info.name).toBe("Real Name");
    });

    it("rate limits explicit saves", async () => {
        const { roomId, manager, store } = seededManager(0);
        const gw = track(await startGateway(manager));
        const client = track(await connectClient(gw.port, roomId));
        await waitFor(() => client.syncStep2 > 0);

        for (let i = 0; i < 20; i++) client.ws.send(JSON.stringify({ t: "flush" }));
        await sleep(200);
        // 3-token burst; the rest are ignored.
        expect(store.saves.get(roomId) ?? 0).toBeLessThanOrEqual(3);
    });
});
