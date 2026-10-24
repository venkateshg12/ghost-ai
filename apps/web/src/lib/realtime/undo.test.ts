import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { getDocNodesMap, toFlowGraph, writeNode, writeNodePosition, type DocNode } from "@repo/types";
import { FlowUndoManager, LOCAL_ORIGIN } from "./undo";

const node = (id: string, x = 0, y = 0): DocNode =>
  ({
    id,
    type: "canvasNode",
    position: { x, y },
    data: { label: id, color: "#000", textColor: "#fff", shape: "rectangle" },
  }) as DocNode;

// Two replicas wired together: an update on one is applied to the other as a remote update.
const pair = () => {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on("update", (update: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(b, update, "remote"));
  b.on("update", (update: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(a, update, "remote"));
  return { a, b };
};

const ids = (doc: Y.Doc) => toFlowGraph(doc).nodes.map((n) => n.id);

describe("FlowUndoManager", () => {
  it("undoes only this user's change and leaves a teammate's later change alone", () => {
    const { a, b } = pair();
    const undoA = new FlowUndoManager(a);

    a.transact(() => writeNode(getDocNodesMap(a), node("mine")), LOCAL_ORIGIN);
    b.transact(() => writeNode(getDocNodesMap(b), node("theirs")), LOCAL_ORIGIN);
    expect(ids(a)).toEqual(["mine", "theirs"]);

    undoA.undo();
    expect(ids(a)).toEqual(["theirs"]);
    expect(ids(b)).toEqual(["theirs"]); // and the undo reached the teammate as an ordinary edit

    undoA.redo();
    expect(ids(a)).toEqual(["mine", "theirs"]);
  });

  it("never undoes an update that came from the AI or the server", () => {
    const { a } = pair();
    const undoA = new FlowUndoManager(a);

    const ai = new Y.Doc();
    Y.applyUpdate(ai, Y.encodeStateAsUpdate(a));
    writeNode(getDocNodesMap(ai), node("ai-node"));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(ai), "remote");

    expect(undoA.getState().canUndo).toBe(false);
    undoA.undo();
    expect(ids(a)).toEqual(["ai-node"]);
  });

  it("treats a whole drag (many position writes close together) as one undo step", () => {
    const { a } = pair();
    const undoA = new FlowUndoManager(a);
    a.transact(() => writeNode(getDocNodesMap(a), node("n", 0, 0)), LOCAL_ORIGIN);
    undoA.manager.stopCapturing(); // the add is its own step

    for (let x = 10; x <= 100; x += 10) {
      a.transact(() => writeNodePosition(a, "n", { x, y: x }), LOCAL_ORIGIN);
    }
    expect(toFlowGraph(a).nodes[0]!.position).toEqual({ x: 100, y: 100 });

    undoA.undo();
    expect(toFlowGraph(a).nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it("starts with nothing to undo once the loaded graph is cleared", () => {
    const { a } = pair();
    const undoA = new FlowUndoManager(a);
    a.transact(() => writeNode(getDocNodesMap(a), node("loaded")), LOCAL_ORIGIN);
    expect(undoA.getState().canUndo).toBe(true);

    undoA.clear();
    expect(undoA.getState()).toEqual({ canUndo: false, canRedo: false });
    undoA.undo();
    expect(ids(a)).toEqual(["loaded"]); // the first undo does not empty the canvas
  });

  it("notifies subscribers when availability changes", () => {
    const { a } = pair();
    const undoA = new FlowUndoManager(a);
    const seen: boolean[] = [];
    undoA.subscribe((s) => seen.push(s.canUndo));

    a.transact(() => writeNode(getDocNodesMap(a), node("x")), LOCAL_ORIGIN);
    undoA.undo();
    expect(seen[0]).toBe(false); // initial state
    expect(seen).toContain(true); // after the edit
    expect(seen.at(-1)).toBe(false); // after the undo
  });

  it("one transaction (a template import) is one step however many nodes it writes", () => {
    const { a } = pair();
    const undoA = new FlowUndoManager(a);
    a.transact(() => {
      for (let i = 0; i < 12; i++) writeNode(getDocNodesMap(a), node(`t${i}`, i * 10, 0));
    }, LOCAL_ORIGIN);
    expect(ids(a)).toHaveLength(12);

    undoA.undo();
    expect(ids(a)).toEqual([]);
  });
});
