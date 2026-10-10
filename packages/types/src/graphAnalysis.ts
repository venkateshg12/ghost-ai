import { undirectedAdjacency, validEdges, type GraphInput } from "./graph";

/*
  Architecture analysis that needs no model: plain graph algorithms plus label heuristics. It runs
  instantly on the client (suggestion chips, the health ring) and on the server (grounding the AI
  review in facts it cannot hallucinate). The score is deliberately transparent — every point lost
  traces back to a finding.
 */

export type Severity = "high" | "medium" | "low";

export interface Finding {
    id: string;
    severity: Severity;
    title: string;
    detail: string;
    nodeIds: string[];
    /** A ready-to-send prompt that would fix it. */
    suggestion?: string;
}

export interface Analysis {
    isEmpty: boolean;
    /** 0–100. */
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    findings: Finding[];
    stats: { nodes: number; edges: number; components: number };
}

const PENALTY: Record<Severity, number> = { high: 15, medium: 8, low: 3 };

const DATASTORE = /\b(db|database|postgres(?:ql)?|mysql|mariadb|mongo(?:db)?|dynamo(?:db)?|cassandra|sql|storage|bucket|s3|warehouse|datastore)\b/i;
const CACHE = /\b(cache|redis|memcached?|cdn|varnish)\b/i;
const QUEUE = /\b(queue|kafka|rabbit(?:mq)?|sqs|sns|pub\/?sub|event[- ]?bus|stream|broker|nats)\b/i;
const ENTRY = /\b(load[- ]?balancer|lb|gateway|nginx|ingress|proxy|haproxy|envoy)\b/i;
const AUTH = /\b(auth|authn|authz|identity|oauth|sso|iam|keycloak|cognito|okta|login)\b/i;
const OBSERVABILITY = /\b(monitor(?:ing)?|logging|logs?|metrics|prometheus|grafana|datadog|tracing|observability|sentry|otel|telemetry|alert(?:ing)?)\b/i;
const CLIENT = /\b(client|browser|web app|mobile|frontend|front-end|ui|app)\b/i;

const matches = (pattern: RegExp, label: string) => pattern.test(label);

const isDatastore = (node: { label: string; shape?: string }) => node.shape === "cylinder" || matches(DATASTORE, node.label);

const gradeOf = (score: number): Analysis["grade"] => (score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F");

// Size of the connected pieces left after removing `removed` (or nothing).
const componentSizes = (adjacency: Map<string, Set<string>>, removed?: string): number[] => {
    const seen = new Set<string>(removed ? [removed] : []);
    const sizes: number[] = [];
    for (const start of adjacency.keys()) {
        if (seen.has(start)) continue;
        let size = 0;
        const stack = [start];
        seen.add(start);
        while (stack.length) {
            const current = stack.pop()!;
            size++;
            for (const next of adjacency.get(current) ?? []) {
                if (!seen.has(next)) {
                    seen.add(next);
                    stack.push(next);
                }
            }
        }
        sizes.push(size);
    }
    return sizes;
};

// Articulation points (cut vertices) by Tarjan's lowlink, iteratively so deep graphs can't overflow the stack.
export const findArticulationPoints = (adjacency: Map<string, Set<string>>): string[] => {
    const discovery = new Map<string, number>();
    const low = new Map<string, number>();
    const points = new Set<string>();
    let clock = 0;

    for (const root of adjacency.keys()) {
        if (discovery.has(root)) continue;

        let rootChildren = 0;
        const stack: { node: string; parent: string | null; neighbours: string[]; next: number }[] = [];
        discovery.set(root, clock);
        low.set(root, clock++);
        stack.push({ node: root, parent: null, neighbours: [...(adjacency.get(root) ?? [])], next: 0 });

        while (stack.length) {
            const frame = stack[stack.length - 1]!;
            if (frame.next < frame.neighbours.length) {
                const neighbour = frame.neighbours[frame.next++]!;
                if (neighbour === frame.parent) continue;
                if (discovery.has(neighbour)) {
                    low.set(frame.node, Math.min(low.get(frame.node)!, discovery.get(neighbour)!));
                } else {
                    if (frame.node === root) rootChildren++;
                    discovery.set(neighbour, clock);
                    low.set(neighbour, clock++);
                    stack.push({ node: neighbour, parent: frame.node, neighbours: [...(adjacency.get(neighbour) ?? [])], next: 0 });
                }
            } else {
                stack.pop();
                const parentFrame = stack[stack.length - 1];
                if (parentFrame) {
                    low.set(parentFrame.node, Math.min(low.get(parentFrame.node)!, low.get(frame.node)!));
                    if (parentFrame.node !== root && low.get(frame.node)! >= discovery.get(parentFrame.node)!) {
                        points.add(parentFrame.node);
                    }
                }
            }
        }
        if (rootChildren > 1) points.add(root);
    }
    return [...points];
};

// Strongly connected components with more than one node: services that depend on each other in a loop.
export const findCycles = (graph: GraphInput): string[][] => {
    const forward = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));
    const backward = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));
    for (const edge of validEdges(graph)) {
        forward.get(edge.source)!.push(edge.target);
        backward.get(edge.target)!.push(edge.source);
    }

    // Kosaraju: finish order on the graph, then sweep the reverse graph in reverse finish order.
    const visited = new Set<string>();
    const order: string[] = [];
    for (const start of forward.keys()) {
        if (visited.has(start)) continue;
        const stack: { node: string; next: number }[] = [{ node: start, next: 0 }];
        visited.add(start);
        while (stack.length) {
            const frame = stack[stack.length - 1]!;
            const targets = forward.get(frame.node)!;
            if (frame.next < targets.length) {
                const target = targets[frame.next++]!;
                if (!visited.has(target)) {
                    visited.add(target);
                    stack.push({ node: target, next: 0 });
                }
            } else {
                order.push(frame.node);
                stack.pop();
            }
        }
    }

    const assigned = new Set<string>();
    const cycles: string[][] = [];
    for (const start of order.reverse()) {
        if (assigned.has(start)) continue;
        const component: string[] = [];
        const stack = [start];
        assigned.add(start);
        while (stack.length) {
            const current = stack.pop()!;
            component.push(current);
            for (const previous of backward.get(current)!) {
                if (!assigned.has(previous)) {
                    assigned.add(previous);
                    stack.push(previous);
                }
            }
        }
        if (component.length > 1) cycles.push(component);
    }
    return cycles;
};

const names = (graph: GraphInput, ids: string[], limit = 4) => {
    const labels = new Map(graph.nodes.map((node) => [node.id, node.label || node.id]));
    const shown = ids.slice(0, limit).map((id) => labels.get(id) ?? id);
    return shown.join(", ") + (ids.length > limit ? ` and ${ids.length - limit} more` : "");
};

export const analyzeGraph = (graph: GraphInput): Analysis => {
    const nodes = graph.nodes;
    if (nodes.length === 0) {
        return { isEmpty: true, score: 0, grade: "F", findings: [], stats: { nodes: 0, edges: 0, components: 0 } };
    }

    const edges = validEdges(graph);
    const adjacency = undirectedAdjacency(graph);
    const findings: Finding[] = [];
    const add = (finding: Finding) => findings.push(finding);

    const labelOf = new Map(nodes.map((node) => [node.id, node.label || node.id]));
    const baseSizes = componentSizes(adjacency);

    // 1. Isolated nodes
    if (nodes.length > 1) {
        const orphans = nodes.filter((node) => (adjacency.get(node.id)?.size ?? 0) === 0).map((node) => node.id);
        if (orphans.length) {
            add({
                id: "orphans",
                severity: "medium",
                title: `${orphans.length} unconnected ${orphans.length === 1 ? "component" : "components"}`,
                detail: `${names(graph, orphans)} ${orphans.length === 1 ? "has" : "have"} no connections, so it is not part of any data flow.`,
                nodeIds: orphans,
                suggestion: "Connect the unconnected components to the rest of the architecture",
            });
        }
    }

    // 2. Separate islands (two or more groups that are internally connected)
    const connectedGroups = baseSizes.filter((size) => size > 1);
    if (connectedGroups.length > 1) {
        add({
            id: "islands",
            severity: "medium",
            title: `The design is split into ${connectedGroups.length} separate groups`,
            detail: "Parts of the system are not connected to each other, so data cannot flow between them.",
            nodeIds: [],
            suggestion: "Connect the separate groups of the architecture where they should interact",
        });
    }

    // 3. Single points of failure
    const cutPoints = findArticulationPoints(adjacency)
        .map((id) => {
            const sizes = componentSizes(adjacency, id);
            const largest = sizes.length ? Math.max(...sizes) : 0;
            return { id, cutOff: nodes.length - 1 - largest };
        })
        .filter((point) => point.cutOff > 0)
        .sort((a, b) => b.cutOff - a.cutOff);
    for (const point of cutPoints.slice(0, 4)) {
        const node = nodes.find((candidate) => candidate.id === point.id)!;
        const datastore = isDatastore(node);
        add({
            id: `spof-${point.id}`,
            severity: datastore ? "high" : "medium",
            title: `Single point of failure: ${labelOf.get(point.id)}`,
            detail: `If ${labelOf.get(point.id)} fails, ${point.cutOff} other ${point.cutOff === 1 ? "component is" : "components are"} cut off from the rest of the system.`,
            nodeIds: [point.id],
            suggestion: datastore
                ? `Add a replica or standby for ${labelOf.get(point.id)}`
                : `Add redundancy for ${labelOf.get(point.id)} so a single failure doesn't disconnect the system`,
        });
    }

    // 4. Shared datastore
    for (const node of nodes.filter(isDatastore)) {
        const clients = edges.filter((edge) => edge.target === node.id).map((edge) => edge.source);
        const callers = [...new Set(clients)].filter((id) => !isDatastore(nodes.find((candidate) => candidate.id === id)!));
        if (callers.length >= 3) {
            add({
                id: `shared-${node.id}`,
                severity: "medium",
                title: `${labelOf.get(node.id)} is shared by ${callers.length} components`,
                detail: `${names(graph, callers)} all use the same datastore, which couples them and makes ${labelOf.get(node.id)} a scaling bottleneck.`,
                nodeIds: [node.id, ...callers],
                suggestion: `Split ${labelOf.get(node.id)} so each service owns its data`,
            });
        }
    }

    // 5. Circular dependencies
    for (const [index, cycle] of findCycles(graph).entries()) {
        add({
            id: `cycle-${index}`,
            severity: "medium",
            title: "Circular dependency",
            detail: `${names(graph, cycle)} depend on each other in a loop, which makes failures cascade and deployments order-sensitive.`,
            nodeIds: cycle,
            suggestion: "Break the circular dependency, for example with an event or a shared interface",
        });
    }

    // 6. Unlabeled connections
    const unlabeled = edges.filter((edge) => !edge.label?.trim());
    if (edges.length >= 3 && unlabeled.length / edges.length > 0.4) {
        add({
            id: "unlabeled-edges",
            severity: "low",
            title: `${unlabeled.length} of ${edges.length} connections have no label`,
            detail: "Edges should say what flows over them (protocol or payload) so the design can be reviewed.",
            nodeIds: [],
            suggestion: "Label every connection with its protocol or the data it carries",
        });
    }

    // 7. Missing building blocks, judged by label. Only for designs big enough to expect them.
    if (nodes.length >= 5) {
        const labels = nodes.map((node) => node.label);
        const has = (pattern: RegExp) => labels.some((label) => matches(pattern, label));
        const services = nodes.filter((node) => !isDatastore(node) && !matches(CLIENT, node.label));

        if (nodes.some(isDatastore) && !has(CACHE)) {
            add({ id: "no-cache", severity: "low", title: "No caching layer", detail: "Reads go straight to the datastore. A cache would cut latency and database load.", nodeIds: [], suggestion: "Add a caching layer in front of the database" });
        }
        if (services.length >= 3 && !has(QUEUE)) {
            add({ id: "no-queue", severity: "low", title: "No asynchronous messaging", detail: "Everything is synchronous. A queue or event bus would absorb spikes and decouple services.", nodeIds: [], suggestion: "Add a message queue for asynchronous work between services" });
        }
        if (services.length >= 2 && !has(ENTRY)) {
            add({ id: "no-entry", severity: "medium", title: "No gateway or load balancer", detail: "Clients reach services directly, so there is no single place for routing, rate limiting or load balancing.", nodeIds: [], suggestion: "Add an API gateway and load balancer in front of the services" });
        }
        if (labels.some((label) => matches(CLIENT, label)) && !has(AUTH)) {
            add({ id: "no-auth", severity: "medium", title: "No authentication component", detail: "The design has clients but nothing that authenticates or authorises them.", nodeIds: [], suggestion: "Add an authentication and authorization service" });
        }
        if (!has(OBSERVABILITY)) {
            add({ id: "no-observability", severity: "low", title: "No monitoring or logging", detail: "There is no way to see failures or performance in production.", nodeIds: [], suggestion: "Add centralized logging and monitoring" });
        }
    }

    const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const penalty = findings.reduce((total, finding) => total + PENALTY[finding.severity], 0);
    // A one- or two-node sketch has nothing to be judged on yet.
    const score = nodes.length < 3 ? 100 : Math.max(0, 100 - penalty);

    return {
        isEmpty: false,
        score,
        grade: gradeOf(score),
        findings,
        stats: { nodes: nodes.length, edges: edges.length, components: baseSizes.length },
    };
};

const STARTERS = ["Design an e-commerce backend", "Create a chat app architecture", "Build a CI/CD pipeline"];

/** Up to three follow-up prompts grounded in the diagram, with no model call. */
export const suggestPrompts = (graph: GraphInput, analysis: Analysis = analyzeGraph(graph), limit = 3): string[] => {
    if (analysis.isEmpty) return STARTERS.slice(0, limit);

    const suggestions = analysis.findings.flatMap((finding) => (finding.suggestion ? [finding.suggestion] : []));
    const generic = ["Review this design for bottlenecks and failure modes", "Explain how data flows through this system"];
    return [...new Set([...suggestions, ...generic])].slice(0, limit);
};
