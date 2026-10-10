import { describe, expect, it } from "vitest";
import { toModelMessages } from "./messages";

const user = (content: string) => ({ role: "user" as const, content });
const assistant = (content: string) => ({ role: "assistant" as const, content });

describe("toModelMessages", () => {
    it("does not repeat the user's latest message, which is already in the feed", () => {
        const result = toModelMessages([user("hi"), assistant("hello"), user("where are the SPOFs?")], "where are the SPOFs?");
        expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
        expect(result.filter((m) => m.content === "where are the SPOFs?")).toHaveLength(1);
    });

    it("appends the prompt when the history does not end with it", () => {
        expect(toModelMessages([user("earlier")], "now this").map((m) => m.content)).toEqual(["earlier\n\nnow this"]);
    });

    it("merges teammates talking in a row so turns alternate", () => {
        const result = toModelMessages([user("a"), user("b"), assistant("c"), assistant("d")], "e");
        expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
        expect(result[0]!.content).toBe("a\n\nb");
    });

    it("never starts with an assistant turn, which several providers reject", () => {
        const result = toModelMessages([assistant("I designed it"), user("thanks")], "what next?");
        expect(result[0]!.role).toBe("user");
    });

    it("works with no history at all", () => {
        expect(toModelMessages([], "hello")).toEqual([{ role: "user", content: "hello" }]);
    });
});
