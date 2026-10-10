import { describe, expect, it } from "vitest";
import { analyzeGraph, findArticulationPoints, findCycles, suggestPrompts } from "./graphAnalysis";
import { undirectedAdjacency, type GraphInput } from "./graph";

const g = (nodes: [string, string?, string?][], edges: [string, string, string?][]): GraphInput => ({
    nodes: nodes.map(([id, label, shape]) => ({ id, label: label ?? id, shape })),
    edges: edges.map(([source, target, label], index) => ({ id: `e${index}`, source, target, label })),
});
const ids = (graph: GraphInput) => analyzeGraph(graph).findings.map((f) => f.id);

describe("findArticulationPoints", () => {
    it("finds the middle of a chain", () => {
        const adjacency = undirectedAdjacency(g([["a"], ["b"], ["c"]], [["a", "b"], ["b", "c"]]));
        expect(findArticulationPoints(adjacency)).toEqual(["b"]);
    });

    it("finds none in a cycle (every node has another way round)", () => {
        const adjacency = undirectedAdjacency(g([["a"], ["b"], ["c"]], [["a", "b"], ["b", "c"], ["c", "a"]]));
        expect(findArticulationPoints(adjacency)).toEqual([]);
    });

    it("handles a long path without overflowing the stack", () => {
        const n = 5000;
        const nodes = Array.from({ length: n }, (_, i) => [`n${i}`] as [string]);
        const edges = Array.from({ length: n - 1 }, (_, i) => [`n${i}`, `n${i + 1}`] as [string, string]);
        expect(findArticulationPoints(undirectedAdjacency(g(nodes, edges)))).toHaveLength(n - 2);
    });
});

describe("findCycles", () => {
    it("finds a loop between services", () => {
        const cycles = findCycles(g([["a"], ["b"], ["c"], ["d"]], [["a", "b"], ["b", "c"], ["c", "a"], ["c", "d"]]));
        expect(cycles).toHaveLength(1);
        expect(cycles[0]!.sort()).toEqual(["a", "b", "c"]);
    });

    it("finds none in a DAG", () => {
        expect(findCycles(g([["a"], ["b"], ["c"]], [["a", "b"], ["b", "c"], ["a", "c"]]))).toEqual([]);
    });
});

describe("analyzeGraph", () => {
    it("treats an empty canvas as empty, not as a failing grade", () => {
        const analysis = analyzeGraph({ nodes: [], edges: [] });
        expect(analysis.isEmpty).toBe(true);
        expect(analysis.findings).toEqual([]);
    });

    it("flags a database that everything depends on as a high-severity single point of failure", () => {
        const analysis = analyzeGraph(g([["web", "Web Client"], ["api", "API Gateway"], ["db", "Orders DB", "cylinder"], ["w2", "Worker"]], [["web", "api", "HTTPS"], ["api", "db", "SQL"], ["w2", "db", "SQL"]]));
        const spof = analysis.findings.find((f) => f.id === "spof-db");
        expect(spof).toMatchObject({ severity: "high" });
        expect(spof!.suggestion).toMatch(/replica|standby/i);
    });

    it("reports unconnected components", () => {
        expect(ids(g([["a"], ["b"], ["lonely"]], [["a", "b", "x"]]))).toContain("orphans");
    });

    it("reports separate groups", () => {
        expect(ids(g([["a"], ["b"], ["c"], ["d"]], [["a", "b", "x"], ["c", "d", "x"]]))).toContain("islands");
    });

    it("reports a datastore shared by three services", () => {
        const analysis = analyzeGraph(g([["s1", "Orders"], ["s2", "Users"], ["s3", "Billing"], ["db", "Postgres", "cylinder"]], [["s1", "db", "x"], ["s2", "db", "x"], ["s3", "db", "x"]]));
        expect(analysis.findings.map((f) => f.id)).toContain("shared-db");
    });

    it("reports unlabeled connections only when many are unlabeled", () => {
        expect(ids(g([["a"], ["b"], ["c"], ["d"]], [["a", "b"], ["b", "c"], ["c", "d"]]))).toContain("unlabeled-edges");
        expect(ids(g([["a"], ["b"], ["c"], ["d"]], [["a", "b", "x"], ["b", "c", "x"], ["c", "d", "x"]]))).not.toContain("unlabeled-edges");
    });

    it("does not nag a small sketch about missing infrastructure", () => {
        const found = ids(g([["a", "Client"], ["b", "API"], ["c", "DB", "cylinder"]], [["a", "b", "x"], ["b", "c", "x"]]));
        expect(found).not.toContain("no-cache");
        expect(found).not.toContain("no-auth");
    });

    it("asks for the missing building blocks of a bigger design, and stops asking once they are drawn", () => {
        const base = [["web", "Web Client"], ["s1", "Order Service"], ["s2", "User Service"], ["s3", "Billing Service"], ["db", "Postgres", "cylinder"]] as [string, string, string?][];
        const edges = [["web", "s1", "x"], ["s1", "s2", "x"], ["s2", "s3", "x"], ["s3", "db", "x"], ["s1", "db", "x"], ["s2", "db", "x"]] as [string, string, string][];
        const before = ids(g(base, edges));
        expect(before).toEqual(expect.arrayContaining(["no-cache", "no-queue", "no-entry", "no-auth", "no-observability"]));

        const full = g(
            [...base, ["gw", "API Gateway"], ["rd", "Redis Cache", "cylinder"], ["mq", "Kafka Queue"], ["au", "Auth Service"], ["mo", "Monitoring"]],
            [...edges, ["web", "gw", "x"], ["gw", "s1", "x"], ["s1", "rd", "x"], ["s2", "mq", "x"], ["gw", "au", "x"], ["s1", "mo", "x"]]
        );
        const after = ids(full);
        for (const resolved of ["no-cache", "no-queue", "no-entry", "no-auth", "no-observability"]) expect(after).not.toContain(resolved);
    });

    it("scores a clean design higher than a flawed one, and sorts findings by severity", () => {
        const flawed = analyzeGraph(g([["a"], ["b"], ["lonely"], ["db", "DB", "cylinder"], ["c"]], [["a", "b"], ["b", "db"], ["c", "db"]]));
        const clean = analyzeGraph(g([["a"], ["b"], ["c"], ["d"]], [["a", "b", "x"], ["b", "c", "x"], ["c", "d", "x"], ["d", "a", "x"]]));
        expect(clean.score).toBeGreaterThan(flawed.score);
        const order = { high: 0, medium: 1, low: 2 } as const;
        const severities = flawed.findings.map((f) => order[f.severity]);
        expect(severities).toEqual([...severities].sort((x, y) => x - y));
    });

    it("never scores below 0 or above 100", () => {
        const analysis = analyzeGraph(g(Array.from({ length: 30 }, (_, i) => [`n${i}`]), []));
        expect(analysis.score).toBeGreaterThanOrEqual(0);
        expect(analysis.score).toBeLessThanOrEqual(100);
    });

    it("ignores edges that point at missing nodes", () => {
        expect(() => analyzeGraph(g([["a"], ["b"]], [["a", "ghost"], ["a", "b", "x"]]))).not.toThrow();
    });
});

describe("suggestPrompts", () => {
    it("offers starters for an empty canvas", () => {
        expect(suggestPrompts({ nodes: [], edges: [] })).toHaveLength(3);
    });

    it("turns findings into prompts, at most three, without duplicates", () => {
        const graph = g([["web", "Web Client"], ["s1", "Order Service"], ["s2", "User Service"], ["s3", "Billing Service"], ["db", "Postgres", "cylinder"]], [["web", "s1"], ["s1", "s2"], ["s2", "s3"], ["s3", "db"]]);
        const prompts = suggestPrompts(graph);
        expect(prompts.length).toBeLessThanOrEqual(3);
        expect(new Set(prompts).size).toBe(prompts.length);
    });
});
