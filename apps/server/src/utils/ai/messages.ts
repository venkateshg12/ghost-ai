import type { ModelMessage } from "ai";
import type { HistoryMessage } from "../liveblocks";

/*
  Providers disagree about turn order (some insist on user-first and strict alternation), and a team chat
  has several people talking in a row. Merging consecutive turns of the same role and dropping any
  leading assistant turn gives every provider a conversation it accepts.
 */
export const toModelMessages = (history: readonly HistoryMessage[], prompt: string): ModelMessage[] => {
    const turns: HistoryMessage[] = [...history];
    // The user's latest message is already in the feed; don't repeat it.
    const last = turns[turns.length - 1];
    if (last && last.role === "user" && last.content.trim() === prompt.trim()) turns.pop();
    turns.push({ role: "user", content: prompt });

    const merged: HistoryMessage[] = [];
    for (const turn of turns) {
        const previous = merged[merged.length - 1];
        if (previous && previous.role === turn.role) previous.content += `\n\n${turn.content}`;
        else merged.push({ ...turn });
    }
    while (merged.length > 1 && merged[0]!.role === "assistant") merged.shift();
    return merged.map((turn) => ({ role: turn.role, content: turn.content }));
};

