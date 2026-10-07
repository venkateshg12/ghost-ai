import { mutateFlow, type MutableFlow } from "@liveblocks/react-flow/node";
import { liveblocks } from "../liveblocks";
import type { FlowEdge, FlowGraph, FlowNode } from "./graph";

type Flow = MutableFlow<FlowNode, FlowEdge>;

/*
  Server-side access to a room's canvas. Changes made inside `editFlow` are written to Liveblocks
  Storage when the callback returns, so every connected editor sees them through `useLiveblocksFlow`
  — the same state a person's edits go through, with undo history on the client untouched.
 */
export const editFlow = (roomId: string, callback: (flow: Flow) => void | Promise<void>) =>
    mutateFlow<FlowNode, FlowEdge>({ client: liveblocks, roomId }, callback);

export const readFlow = async (roomId: string): Promise<FlowGraph> => {
    let graph: FlowGraph = { nodes: [], edges: [] };
    await editFlow(roomId, (flow) => {
        const snapshot = flow.toJSON();
        graph = { nodes: [...snapshot.nodes], edges: [...snapshot.edges] };
    });
    return graph;
};
