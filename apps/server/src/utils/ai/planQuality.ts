import type { DesignOperation, DesignPlan } from "./design";
import type { FlowGraph } from "./graph";

/*
  A language model's plan is a suggestion, not a command. Before anything touches the shared canvas it
  is repaired (dangling edges, duplicates, ordering) and then judged. A plan that is syntactically
  valid but useless — measured in practice: 11 nodes and one edge — is rejected so the provider chain
  moves on instead of drawing it.
 */
export class PlanQualityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PlanQualityError";
    }
}

const prettify = (id: string) =>
    id
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const NODE_EDIT = new Set<DesignOperation["type"]>(["update_node", "move_node", "resize_node"]);

export interface RepairResult {
    plan: DesignPlan;
    /** Why operations were dropped, for logs. */
    dropped: string[];
}

/*
  Executed in a fixed order regardless of how the model listed them: nodes before the edges that use
  them (the applier skips an edge whose endpoint does not exist yet), deletions last.
 */
export const repairPlan = (graph: FlowGraph, plan: DesignPlan): RepairResult => {
    const dropped: string[] = [];
    const existingNodes = new Set(graph.nodes.map((node) => node.id));
    const existingEdges = new Set(graph.edges.map((edge) => edge.id));

    const addedNodes = new Set<string>();
    const deletedNodes = new Set(
        plan.operations.filter((op) => op.type === "delete_node" && existingNodes.has(op.id?.trim())).map((op) => op.id.trim())
    );
    const known = (id: string) => (existingNodes.has(id) || addedNodes.has(id)) && !deletedNodes.has(id);

    const nodeAdds: DesignOperation[] = [];
    const nodeEdits: DesignOperation[] = [];
    const edgeAdds: DesignOperation[] = [];
    const edgeDeletes: DesignOperation[] = [];
    const nodeDeletes: DesignOperation[] = [];

    // Pass 1: which node ids will exist, so edges listed before their nodes are still accepted.
    for (const op of plan.operations) {
        const id = op.id?.trim();
        if (op.type === "add_node" && id && !addedNodes.has(id)) addedNodes.add(id);
    }

    // Models sometimes name an edge endpoint by its label ("Order Service"), or leak reasoning into the field
    // ("api-server Wait, the target is api-server"). Instead of dropping such an edge, snap the reference to the
    // node it clearly means: an id the text starts with, or a label that matches ignoring case and punctuation.
    const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const labelToId = new Map<string, string>();
    for (const node of graph.nodes) labelToId.set(normalize(node.data?.label ?? node.id), node.id);
    for (const op of plan.operations) if (op.type === "add_node" && op.id?.trim()) labelToId.set(normalize(op.label ?? op.id), op.id.trim());
    const resolveRef = (reference: string | undefined): string | undefined => {
        const value = reference?.trim();
        if (!value) return undefined;
        if (known(value)) return value;

        let best: string | undefined;
        for (const id of [...existingNodes, ...addedNodes]) {
            const next = value.charAt(id.length);
            if (known(id) && value.startsWith(id) && !/[A-Za-z0-9_-]/.test(next) && (!best || id.length > best.length)) best = id;
        }
        if (best) return best;

        const byLabel = labelToId.get(normalize(value));
        return byLabel && known(byLabel) ? byLabel : undefined;
    };

    const seenAdds = new Set<string>();
    const seenPairs = new Set(graph.edges.map((edge) => `${edge.source}>${edge.target}`));
    const usedEdgeIds = new Set(existingEdges);

    for (const operation of plan.operations) {
        const id = operation.id?.trim();
        if (!id) {
            dropped.push(`${operation.type} without an id`);
            continue;
        }
        const op = { ...operation, id };

        if (op.type === "add_node") {
            if (seenAdds.has(id)) {
                dropped.push(`duplicate node ${id}`);
                continue;
            }
            seenAdds.add(id);
            nodeAdds.push({ ...op, label: op.label?.trim() || prettify(id) });
        } else if (NODE_EDIT.has(op.type)) {
            if (known(id)) nodeEdits.push(op);
            else dropped.push(`${op.type} on unknown node ${id}`);
        } else if (op.type === "add_edge") {
            const source = resolveRef(op.source);
            const target = resolveRef(op.target);
            if (!op.source?.trim() || !op.target?.trim()) {
                dropped.push(`edge ${id} has no valid endpoints`);
            } else if (!source || !target) {
                dropped.push(`edge ${id} points at a missing node`);
            } else if (source === target) {
                dropped.push(`edge ${id} connects a node to itself`);
            } else if (seenPairs.has(`${source}>${target}`)) {
                dropped.push(`duplicate edge ${source} -> ${target}`);
            } else {
                seenPairs.add(`${source}>${target}`);
                let edgeId = id;
                if (usedEdgeIds.has(edgeId)) edgeId = `${source}-${target}`;
                usedEdgeIds.add(edgeId);
                edgeAdds.push({ ...op, id: edgeId, source, target });
            }
        } else if (op.type === "delete_edge") {
            if (existingEdges.has(id)) edgeDeletes.push(op);
            else dropped.push(`delete_edge on unknown edge ${id}`);
        } else if (op.type === "delete_node") {
            if (existingNodes.has(id)) nodeDeletes.push(op);
            else dropped.push(`delete_node on unknown node ${id}`);
        }
    }

    return {
        plan: { ...plan, operations: [...nodeAdds, ...nodeEdits, ...edgeAdds, ...edgeDeletes, ...nodeDeletes] },
        dropped,
    };
};

// A first design needs real structure: enough nodes, and edges connecting most of them.
const MIN_FIRST_DESIGN_NODES = 3;
const MIN_EDGE_RATIO = 0.6;

/*
  Throws when a (repaired) plan should not be applied. `requested` is how many operations the model
  produced before repair: if repair removed all of them, nothing usable is left.
 */
export const assertPlanQuality = (graph: FlowGraph, plan: DesignPlan, requested = plan.operations.length): void => {
    if (requested > 0 && plan.operations.length === 0) {
        throw new PlanQualityError("None of the proposed changes could be applied to this canvas");
    }

    const nodeAdds = plan.operations.filter((op) => op.type === "add_node").length;
    const edgeAdds = plan.operations.filter((op) => op.type === "add_edge").length;

    if (graph.nodes.length === 0 && nodeAdds > 0) {
        if (nodeAdds < MIN_FIRST_DESIGN_NODES) {
            throw new PlanQualityError(`The design has only ${nodeAdds} components`);
        }
        const needed = Math.ceil((nodeAdds - 1) * MIN_EDGE_RATIO);
        if (edgeAdds < needed) {
            throw new PlanQualityError(`The design has ${nodeAdds} components but only ${edgeAdds} connections`);
        }
    }
};
