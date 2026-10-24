/**
 * Realtime load and convergence test.
 *
 * For each client count it starts a real gateway on a free port, opens that many real WebSocket clients (tickets
 * issued directly), and has every client make random edits for the duration: add, move, relabel, connect and
 * delete nodes. Latency is measured end to end: the sender stamps the time inside a node's data, and every other
 * client reads it back when the update arrives. At the end all client documents and the server's own document
 * must be identical.
 *
 * Persistence and feeds are in-memory here, so the run never touches blob storage or Postgres.
 *
 *   pnpm --filter server realtime:load                          # 2, 5, 20 and 50 clients, 60 s each
 *   pnpm --filter server realtime:load -- --clients=2,5 --duration=10
 *
 * CPU and memory are for this whole process (server and simulated clients together), so they overstate what the
 * server alone would use.
 */
import "dotenv/config";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import * as Y from "yjs";
import {
    FRAME,
    decodeBinaryFrame,
    encodeBinaryFrame,
    getDocEdgesMap,
    getDocNodesMap,
    toFlowGraph,
    writeEdge,
    writeNode,
    writeNodeData,
    writeNodePosition,
    type DocEdge,
    type DocNode,
} from "@repo/types";
import { issueTicket } from "../realtime/tickets";
import { attachRealtime } from "../realtime/gateway";
import { RoomManager } from "../realtime/roomManager";
import { MemoryBusHub } from "../realtime/memoryBus";
import type { RoomFeeds } from "../realtime/feeds";

const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const CLIENT_COUNTS = arg("clients", "2,5,20,50").split(",").map(Number);
const DURATION_S = Number(arg("duration", "60"));
const OPS_PER_SECOND = 10; // per client

const failingStore = {
    set: async () => {
        throw new Error("no redis in the load test");
    },
};

const noFeeds = (): RoomFeeds => ({
    getRecentMessages: async () => ({}),
    listFeedMessages: async () => [],
    createMessage: async () => null,
    updateMessage: async () => null,
    onClientFeedCreate: async () => false,
});

const percentile = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]! : NaN);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const nodeOf = (id: string, x: number, y: number): DocNode =>
    ({
        id,
        type: "canvasNode",
        position: { x, y },
        data: { label: id, color: "#1F1F1F", textColor: "#EDEDED", shape: "rectangle" },
    }) as DocNode;

async function runScenario(clientCount: number, durationSeconds: number) {
    console.log(`\n=== ${clientCount} clients, ${durationSeconds}s ===`);

    const manager = new RoomManager({
        bus: new MemoryBusHub().createBus(),
        load: async () => new Y.Doc(),
        save: async () => ({ savedAt: Date.now() }),
        createFeeds: noFeeds,
    });
    const server = createServer();
    attachRealtime(server, manager);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const roomId = crypto.randomUUID();

    const latencies: number[] = [];
    let framesReceived = 0;
    let bytesReceived = 0;

    interface Client {
        ws: WebSocket;
        doc: Y.Doc;
        index: number;
        ownNode: string;
    }
    const clients: Client[] = [];

    for (let i = 0; i < clientCount; i++) {
        const ticket = await issueTicket(
            { userId: `user_${i}`, roomId, userInfo: { name: `User ${i}`, color: "#3b82f6", avatar: null } },
            failingStore as never
        );
        const ws = new WebSocket(`ws://127.0.0.1:${port}/realtime?ticket=${ticket}`, { headers: { Origin: "http://localhost:3000" } });
        const doc = new Y.Doc();
        const client: Client = { ws, doc, index: i, ownNode: `stamp-${i}` };
        clients.push(client);

        // Latency: when a remote update changes another client's stamp node, now - sentAt is the delivery time.
        getDocNodesMap(doc).observeDeep((events, tx) => {
            if (tx.origin !== "remote") return;
            for (const event of events) {
                const nodeKey = event.path[0];
                if (typeof nodeKey !== "string" || !nodeKey.startsWith("stamp-") || nodeKey === client.ownNode) continue;
                const data = getDocNodesMap(doc).get(nodeKey)?.get("data");
                const sentAt = data && typeof (data as Y.Map<unknown>).get === "function" ? Number((data as Y.Map<unknown>).get("sentAt")) : NaN;
                if (Number.isFinite(sentAt)) latencies.push(Date.now() - sentAt);
            }
        });

        ws.on("message", (data: Buffer, isBinary: boolean) => {
            framesReceived++;
            bytesReceived += data.byteLength;
            if (!isBinary) return;
            const { type, payload } = decodeBinaryFrame(new Uint8Array(data));
            if (type === FRAME.SYNC_STEP1) ws.send(encodeBinaryFrame(FRAME.SYNC_STEP2, Y.encodeStateAsUpdate(doc, payload)));
            else Y.applyUpdate(doc, payload, "remote");
        });
        doc.on("update", (update: Uint8Array, origin: unknown) => {
            if (origin !== "remote" && ws.readyState === WebSocket.OPEN) ws.send(encodeBinaryFrame(FRAME.UPDATE, update));
        });

        await new Promise<void>((resolve, reject) => {
            ws.on("open", () => {
                ws.send(encodeBinaryFrame(FRAME.SYNC_STEP1, Y.encodeStateVector(doc)));
                resolve();
            });
            ws.on("error", reject);
        });
    }
    await sleep(300);

    // Every client owns a node it stamps; the rest of the workload is shared and concurrent.
    for (const c of clients) c.doc.transact(() => writeNode(getDocNodesMap(c.doc), nodeOf(c.ownNode, c.index * 40, 0)), "local");
    await sleep(300);

    const cpuStart = process.cpuUsage();
    const wallStart = Date.now();
    let ops = 0;

    const timers = clients.map((c) =>
        setInterval(() => {
            const nodes = getDocNodesMap(c.doc);
            const edges = getDocEdgesMap(c.doc);
            const shared = Array.from(nodes.keys()).filter((k) => !k.startsWith("stamp-"));
            const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

            c.doc.transact(() => {
                writeNodeData(c.doc, c.ownNode, { sentAt: Date.now() } as never); // the latency probe, every tick
                const roll = Math.random();
                const target = pick(shared);
                if (shared.length >= 300 && target) {
                    nodes.delete(target); // stay well under the room's node cap
                } else if (roll < 0.25 || !target) {
                    const id = `n-${c.index}-${ops}`;
                    writeNode(nodes, nodeOf(id, Math.random() * 2000, Math.random() * 1000));
                } else if (roll < 0.6) {
                    writeNodePosition(c.doc, target, { x: Math.random() * 2000, y: Math.random() * 1000 });
                } else if (roll < 0.75) {
                    writeNodeData(c.doc, target, { label: `edited by ${c.index}` });
                } else if (edges.size >= 600) {
                    const oldest = edges.keys().next().value;
                    if (oldest) edges.delete(oldest);
                } else if (roll < 0.9 && shared.length > 1) {
                    const other = pick(shared.filter((k) => k !== target));
                    if (other) writeEdge(edges, { id: `e-${c.index}-${ops}`, type: "canvasEdge", source: target, target: other } as DocEdge);
                } else if (shared.length > 20) {
                    nodes.delete(target);
                }
            }, "local");
            ops++;
        }, 1000 / OPS_PER_SECOND)
    );

    await sleep(durationSeconds * 1000);
    timers.forEach(clearInterval);
    await sleep(1500); // let in-flight updates land

    const cpu = process.cpuUsage(cpuStart);
    const elapsedS = (Date.now() - wallStart) / 1000;
    const mem = process.memoryUsage();

    const serverDoc = manager.getRoom(roomId)?.doc;
    const serverState = serverDoc ? JSON.stringify(toFlowGraph(serverDoc)) : "";
    const converged = clients.every((c) => JSON.stringify(toFlowGraph(c.doc)) === serverState);
    const graph = serverDoc ? toFlowGraph(serverDoc) : { nodes: [], edges: [] };

    for (const c of clients) c.ws.close();
    await sleep(100);
    await new Promise<void>((resolve) => server.close(() => resolve()));

    latencies.sort((a, b) => a - b);
    const result = {
        clients: clientCount,
        converged,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        samples: latencies.length,
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
        msgPerSec: Math.round(framesReceived / elapsedS),
        kbPerSec: Math.round(bytesReceived / 1024 / elapsedS),
        cpuPct: Math.round(((cpu.user + cpu.system) / 1000 / (elapsedS * 1000)) * 100),
        rssMb: Math.round(mem.rss / 1024 / 1024),
    };

    console.log(`convergence : ${converged ? "PASSED (all clients and the server hold identical documents)" : "FAILED"}`);
    console.log(`document    : ${result.nodes} nodes, ${result.edges} edges`);
    console.log(`latency     : p50 ${result.p50} ms | p95 ${result.p95} ms | p99 ${result.p99} ms  (${result.samples} samples)`);
    console.log(`traffic     : ${result.msgPerSec} frames/s received by clients, ${result.kbPerSec} KiB/s`);
    console.log(`process     : ${result.cpuPct}% of one core, RSS ${result.rssMb} MB (server + clients)`);
    return result;
}

async function main() {
    console.log(`Realtime load test: clients ${CLIENT_COUNTS.join(", ")}, ${DURATION_S}s each, ${OPS_PER_SECOND} ops/s per client`);
    const results = [];
    for (const count of CLIENT_COUNTS) results.push(await runScenario(count, DURATION_S));

    console.log("\n| Clients | Converged | p50 | p95 | p99 | Frames/s | CPU | RSS |");
    console.log("|---|---|---|---|---|---|---|---|");
    for (const r of results) {
        console.log(`| ${r.clients} | ${r.converged ? "yes" : "NO"} | ${r.p50} ms | ${r.p95} ms | ${r.p99} ms | ${r.msgPerSec} | ${r.cpuPct}% | ${r.rssMb} MB |`);
    }

    process.exit(results.every((r) => r.converged && r.samples > 0) ? 0 : 1);
}

main().catch((err) => {
    console.error("Load test failed:", err);
    process.exit(1);
});
