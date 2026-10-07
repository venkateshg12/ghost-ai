import { generateText, Output } from "ai";
import { z } from "zod";
import { NODE_COLORS, NODE_SHAPES } from "@repo/types";
import { getGeminiModel } from "./model";
import { describeGraph, type FlowGraph } from "./graph";

/*
  The model doesn't return a whole new graph; it returns edits to the current one. That is what lets
  "add a cache in front of the database" change one corner of a design instead of replacing it, and
  it is the same set of actions a person can take on the canvas.

  One flat object per operation rather than a union: Gemini's structured output handles optional
  fields far more reliably than `anyOf`, and every field is validated again when it is applied.
 */
export const DESIGN_OPERATION_TYPES = [
    "add_node",
    "update_node",
    "move_node",
    "resize_node",
    "delete_node",
    "add_edge",
    "delete_edge",
] as const;

const colorLabels = NODE_COLORS.map((pair) => pair.label) as [string, ...string[]];

const designOperationSchema = z.object({
    type: z.enum(DESIGN_OPERATION_TYPES),
    id: z.string().describe("Node or edge id. New ids must be unique, short and kebab-case."),
    label: z.string().optional(),
    shape: z.enum(NODE_SHAPES).optional(),
    color: z.enum(colorLabels).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    source: z.string().optional().describe("add_edge only: source node id"),
    target: z.string().optional().describe("add_edge only: target node id"),
});

export const designPlanSchema = z.object({
    summary: z.string().describe("One or two sentences for the chat, describing what was changed."),
    operations: z.array(designOperationSchema).max(80),
});

export type DesignOperation = z.infer<typeof designOperationSchema>;
export type DesignPlan = z.infer<typeof designPlanSchema>;

const SYSTEM_PROMPT = `You are Ghost AI, a principal system architect working on a shared diagram canvas.
Turn the user's request into edit operations on the current canvas.

Shapes and what they mean:
- rectangle: general service or component
- pill: client app, process or worker
- cylinder: database, cache or storage
- hexagon: external system, third party or boundary
- diamond: decision, gateway or router
- circle: event, queue topic or endpoint

Colours (use the label): ${NODE_COLORS.map((pair) => pair.label).join(", ")}.
Use colour to group related parts (e.g. Blue for clients, Purple for services, Green for data stores).

Layout rules:
- Flow left to right in columns 260px apart, rows 160px apart, starting near x=80, y=80.
- Never overlap nodes; keep at least 60px between them.
- Default sizes: rectangle 160x70, pill 160x60, cylinder 110x120, hexagon 150x100, diamond 130x110, circle 100x100.

Editing rules:
- Reuse existing node ids when changing or connecting existing nodes; never re-add a node that exists.
- If the canvas is empty, design the full system (typically 5-14 nodes).
- Every edge connects two node ids that exist or are added in the same plan; label edges with the protocol or data (e.g. "HTTPS", "SQL", "publish").
- Keep labels short (1-4 words).`;

export const generateDesignPlan = async (prompt: string, graph: FlowGraph): Promise<DesignPlan> => {
    const model = getGeminiModel();
    if (!model) return fallbackDesignPlan(prompt, graph);

    const { output } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        output: Output.object({ schema: designPlanSchema }),
        prompt: `Current canvas:\n${describeGraph(graph)}\n\nRequest: ${prompt}`,
    });
    return output;
};

/* ---------- Fallback (no API key) ---------- */

type FallbackNode = { id: string; label: string; shape: (typeof NODE_SHAPES)[number]; color: string; col: number; row: number };
type FallbackEdge = [string, string, string];

const FALLBACK_DESIGNS: Array<{ match: RegExp; name: string; nodes: FallbackNode[]; edges: FallbackEdge[] }> = [
    {
        match: /e-?commerce|shop|store|checkout/i,
        name: "an e-commerce backend",
        nodes: [
            { id: "storefront", label: "Storefront", shape: "pill", color: "Blue", col: 0, row: 1 },
            { id: "api-gateway", label: "API Gateway", shape: "hexagon", color: "Teal", col: 1, row: 1 },
            { id: "catalog-service", label: "Catalog Service", shape: "rectangle", color: "Purple", col: 2, row: 0 },
            { id: "order-service", label: "Order Service", shape: "rectangle", color: "Purple", col: 2, row: 1 },
            { id: "payment-gateway", label: "Payment Provider", shape: "hexagon", color: "Orange", col: 2, row: 2 },
            { id: "products-db", label: "Products DB", shape: "cylinder", color: "Green", col: 3, row: 0 },
            { id: "orders-db", label: "Orders DB", shape: "cylinder", color: "Green", col: 3, row: 1 },
        ],
        edges: [
            ["storefront", "api-gateway", "HTTPS"],
            ["api-gateway", "catalog-service", "REST"],
            ["api-gateway", "order-service", "REST"],
            ["order-service", "payment-gateway", "charge"],
            ["catalog-service", "products-db", "SQL"],
            ["order-service", "orders-db", "SQL"],
        ],
    },
    {
        match: /chat|messag|realtime|real-time/i,
        name: "a chat application",
        nodes: [
            { id: "chat-client", label: "Chat Client", shape: "pill", color: "Blue", col: 0, row: 1 },
            { id: "load-balancer", label: "Load Balancer", shape: "diamond", color: "Teal", col: 1, row: 1 },
            { id: "ws-gateway", label: "WebSocket Gateway", shape: "rectangle", color: "Purple", col: 2, row: 0 },
            { id: "message-service", label: "Message Service", shape: "rectangle", color: "Purple", col: 2, row: 2 },
            { id: "pubsub", label: "Pub/Sub", shape: "circle", color: "Orange", col: 3, row: 0 },
            { id: "messages-db", label: "Messages DB", shape: "cylinder", color: "Green", col: 3, row: 2 },
        ],
        edges: [
            ["chat-client", "load-balancer", "WSS"],
            ["load-balancer", "ws-gateway", "upgrade"],
            ["load-balancer", "message-service", "REST"],
            ["ws-gateway", "pubsub", "subscribe"],
            ["message-service", "pubsub", "publish"],
            ["message-service", "messages-db", "write"],
        ],
    },
    {
        match: /ci\/?cd|pipeline|deploy/i,
        name: "a CI/CD pipeline",
        nodes: [
            { id: "git-repo", label: "Git Repository", shape: "pill", color: "Blue", col: 0, row: 1 },
            { id: "webhook", label: "Webhook Trigger", shape: "diamond", color: "Orange", col: 1, row: 1 },
            { id: "build-runner", label: "Build & Test", shape: "rectangle", color: "Purple", col: 2, row: 0 },
            { id: "registry", label: "Container Registry", shape: "cylinder", color: "Green", col: 2, row: 2 },
            { id: "cluster", label: "K8s Cluster", shape: "hexagon", color: "Teal", col: 3, row: 1 },
        ],
        edges: [
            ["git-repo", "webhook", "push"],
            ["webhook", "build-runner", "trigger"],
            ["build-runner", "registry", "push image"],
            ["registry", "cluster", "deploy"],
        ],
    },
];

const DEFAULT_FALLBACK = {
    name: "a three-tier web system",
    nodes: [
        { id: "client-app", label: "Client App", shape: "pill", color: "Blue", col: 0, row: 1 },
        { id: "load-balancer", label: "Load Balancer", shape: "diamond", color: "Teal", col: 1, row: 1 },
        { id: "app-server", label: "App Server", shape: "rectangle", color: "Purple", col: 2, row: 1 },
        { id: "cache", label: "Cache", shape: "cylinder", color: "Orange", col: 3, row: 0 },
        { id: "primary-db", label: "Primary DB", shape: "cylinder", color: "Green", col: 3, row: 2 },
    ] as FallbackNode[],
    edges: [
        ["client-app", "load-balancer", "HTTPS"],
        ["load-balancer", "app-server", "forward"],
        ["app-server", "cache", "read"],
        ["app-server", "primary-db", "SQL"],
    ] as FallbackEdge[],
};

/*
  Used when no Gemini key is configured. Picks a canned design by keyword and lays it out to the
  right of anything already on the canvas, so it never draws over existing work.
 */
export const fallbackDesignPlan = (prompt: string, graph: FlowGraph): DesignPlan => {
    const design = FALLBACK_DESIGNS.find((candidate) => candidate.match.test(prompt)) ?? DEFAULT_FALLBACK;
    const offsetX = graph.nodes.length
        ? Math.max(...graph.nodes.map((node) => node.position.x)) + 320
        : 80;
    const suffix = Date.now().toString(36).slice(-4);
    const idOf = (id: string) => `${id}-${suffix}`;

    const operations: DesignOperation[] = [
        ...design.nodes.map((node) => ({
            type: "add_node" as const,
            id: idOf(node.id),
            label: node.label,
            shape: node.shape,
            color: node.color,
            x: offsetX + node.col * 260,
            y: 80 + node.row * 160,
        })),
        ...design.edges.map(([source, target, label]) => ({
            type: "add_edge" as const,
            id: `edge-${idOf(source)}-${idOf(target)}`,
            source: idOf(source),
            target: idOf(target),
            label,
        })),
    ];

    return {
        summary: `Drafted ${design.name} with ${design.nodes.length} components. (Offline mode: set GOOGLE_GENERATIVE_AI_API_KEY for designs tailored to your prompt.)`,
        operations,
    };
};
